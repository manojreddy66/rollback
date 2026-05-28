/**
 * @description DB operations to update/create groups, upsert scenario links,
 * and update scenario step status
 */

const { dbConnect } = require("prismaORM/index");
const { groupingData } = require("prismaORM/services/groupingService");
const {
  groupScenarioMapperData,
} = require("prismaORM/services/groupScenarioMapperService");
const {
  namcLineSubseriesData,
} = require("prismaORM/services/namcLineSubseriesService");
const {
  groupNamcLineSeriesMapperData,
} = require("prismaORM/services/groupNamcLineSeriesMapperService");
const {
  scenarioStepStatusData,
} = require("prismaORM/services/scenarioStepStatusService");
const { scenariosData } = require("prismaORM/services/scenariosService");
const { minMaxDohData } = require("prismaORM/services/minMaxDohService");
const { monthlyFaData } = require("prismaORM/services/monthlyFaService");
const { VALID_STEP_NAMES } = require("constants/customConstants");
const { updateScenarioNStepStatus } = require("utils/common_utils");
const {
  segregateUpdateAndNewGroupInput,
  prepareScenarioLinksData,
} = require("./utils");
const { BadRequest } = require("utils/api_response_utils");

/**
 * @description Function to create/update groups and update scenario step status
 * @param {Object} body - request payload
 * @param {Object} scenarioData - scenario row for the given scenarioId
 * @returns {Promise<void>} Void if successful
 */
async function upsertGroupsNStepStatus(body, scenarioData) {
  const rdb = await dbConnect();
  const groupingService = new groupingData(rdb);
  const groupScenarioMapperService = new groupScenarioMapperData(rdb);
  const namcLineSubseriesService = new namcLineSubseriesData(rdb);
  const groupNamcLineSeriesMapperService = new groupNamcLineSeriesMapperData(
    rdb
  );
  const scenarioStepStatusDataService = new scenarioStepStatusData(rdb);
  const scenariosDataService = new scenariosData(rdb);
  const minMaxDohDataService = new minMaxDohData(rdb);
  const monthlyFaDataService = new monthlyFaData(rdb);
  try {
    const { scenarioId, userEmail, data } = body;
    await rdb.prisma.$transaction(async (tx) => {
      /**
       * @description Segregate update and new groups from input to handle them separately in processing
       */
      const { updateGroups, newGroups } = segregateUpdateAndNewGroupInput(data);
      const allInputGroups = [...updateGroups, ...newGroups];
      /**
       * @description Function to deactivate existing scenario links for update groups only
       * @returns {Promise<void>} Void if successful
       */
      await deactivateExistingScenarioLinksForUpdateGroups(
        updateGroups,
        scenarioId,
        userEmail,
        groupScenarioMapperService,
        tx
      );
      /**
       * @description Function to finalize group ids for all input groups
       * by reusing existing groups where possible
       * or creating new groups and necessary mappings
       * @returns {Promise<Object>} Object containing finalGroupsData and groupIdTransferMappings
       */
      const { finalGroupsData, groupIdTransferMappings } =
        await finalizeGroupIdsForAllInputGroups(
          allInputGroups,
          scenarioData,
          userEmail,
          groupingService,
          namcLineSubseriesService,
          groupNamcLineSeriesMapperService,
          tx
        );
      /**
       * @description Bulk upsert final scenario links
       */
      const scenarioLinksData = prepareScenarioLinksData(
        scenarioId,
        userEmail,
        finalGroupsData
      );
      await Promise.all([
        /* Bulk upsert group scenario links */
        groupScenarioMapperService.upsertScenarioLinksBulk(
          scenarioLinksData,
          tx
        ),
        /* Bulk update min max doh data */
        minMaxDohDataService.updateGroupIdsInMinMaxDoh(
          scenarioId,
          groupIdTransferMappings,
          tx
        ),
        /* Bulk update monthly fa data */
        monthlyFaDataService.updateGroupIdsInMonthlyFA(
          scenarioId,
          groupIdTransferMappings,
          tx
        ),
        /* Update scenario step status & scenario status to in progress */
        updateScenarioNStepStatus(
          body,
          scenarioData,
          VALID_STEP_NAMES[6],
          scenarioStepStatusDataService,
          scenariosDataService,
          tx
        ),
      ]);
    });
  } catch (err) {
    console.log("Error in upsertGroupsNStepStatus:", err);
    throw err;
  }
}

/**
 * @description Function to deactivate existing scenario links for update groups only
 * @param {Array} updateGroups: Update groups from input
 * @param {*} groupScenarioMapperService: DB service for group scenario mapper table
 * @param {*} scenarioId: Scenario id for which groups are being updated
 * @param {*} userEmail: User email for audit
 * @param {*} tx: Prisma transaction client
 * @returns {Promise<void>} Void if successful
 */
async function deactivateExistingScenarioLinksForUpdateGroups(
  updateGroups,
  scenarioId,
  userEmail,
  groupScenarioMapperService,
  tx
) {
  /**
   * @description Deactivate old scenario links for update rows only
   */
  if (updateGroups.length > 0) {
    await groupScenarioMapperService.deactivateScenarioLinks(
      scenarioId,
      updateGroups.map((item) => item.groupScenarioMapId),
      userEmail,
      tx
    );
  }
}

/**
 * @description Function to finalize group ids for all input groups
 * by reusing existing groups where possible
 * or creating new groups and necessary mappings
 * @param {Array} allInputGroups: All groups from input (both update and new)
 * @param {Object} scenarioData: Scenario data for the given scenarioId
 * @param {*} userEmail: User email for audit
 * @param {*} groupingService: DB service for grouping table
 * @param {*} namcLineSubseriesService: DB service for namc line subseries table
 * @param {*} groupNamcLineSeriesMapperService: DB service for group namc line series mapper table
 * @param {*} tx: Prisma transaction client
 * @returns {Promise<Object>} Object containing finalGroupsData and groupIdTransferMappings
 */
async function finalizeGroupIdsForAllInputGroups(
  allInputGroups,
  scenarioData,
  userEmail,
  groupingService,
  namcLineSubseriesService,
  groupNamcLineSeriesMapperService,
  tx
) {
  /**
   * @description Process each row and collect chosen group ids
   */
  const finalGroupsData = [];
  const groupIdTransferMappings = [];
  for (const item of allInputGroups) {
    /**
     * @description For update rows, try to reuse existing group if config matches 
     * or else create new group and necessary mappings
      For new rows, directly try to reuse existing group if config matches 
      or else create new group and necessary mappings
     */
    const groupId = await fetchExistingOrCreateNewGroup(
      item,
      scenarioData,
      userEmail,
      groupingService,
      namcLineSubseriesService,
      groupNamcLineSeriesMapperService,
      tx
    );
    finalGroupsData.push({
      groupId: groupId,
      groupName: item.groupName,
    });
    /**
     * Create a mapping of old group id to new group id
     * for update min max & monthly fa data where group id has changed after processing
     */
    if (
      typeof item.groupScenarioMapId === "string" &&
      typeof item.groupId === "string" &&
      item.groupId !== groupId
    ) {
      groupIdTransferMappings.push({
        oldGroupId: item.groupId,
        newGroupId: groupId,
      });
    }
  }
  return { finalGroupsData, groupIdTransferMappings };
}

/**
 * @description Function to get reusable groupId or create a new group and mappings
 * @param {Object} item - current request row
 * @param {Object} scenarioData - scenario row
 * @param {String} userEmail - user email for audit
 * @param {Object} groupingService - grouping service instance
 * @param {Object} namcLineSubseriesService - namc line subseries service instance
 * @param {Object} groupNamcLineSeriesMapperService - group mapper service instance
 * @param {Object} tx - prisma transaction client
 * @returns {Promise<String>} finalized groupId
 */
async function fetchExistingOrCreateNewGroup(
  item,
  scenarioData,
  userEmail,
  groupingService,
  namcLineSubseriesService,
  groupNamcLineSeriesMapperService,
  tx
) {
  /**
   * @description First try to find reusable group by exact config
   */
  const reusableGroup = await groupingService.findReusableGroupId(
    scenarioData.namc,
    scenarioData.line,
    item.vanningCenter,
    item.subSeriesList,
    tx
  );
  /* If a group exists with exact config */
  if (reusableGroup && reusableGroup.length > 0) {
    return reusableGroup[0].groupId;
  }
  /**
   * @description No reusable group found, create new grouping row
   */
  const insertedGroup = await groupingService.insertGroupingData(
    item.vanningCenter,
    userEmail,
    tx
  );
  const groupId = insertedGroup[0].groupId;
  /**
   * @description Resolve namc_line_series_id values for subSeriesList
   */
  const resolvedSubSeries =
    await namcLineSubseriesService.getNamcLineSeriesIdsBySubSeriesList(
      scenarioData.namc,
      scenarioData.line,
      item.subSeriesList,
      tx
    );
  const namcLineSeriesIds = resolvedSubSeries.map(
    (row) => row.namcLineSeriesId
  );
  /**
   * If provided subseries are invalid i.e. no mapping found with scenario namc & line
   */
  if (
    !namcLineSeriesIds ||
    namcLineSeriesIds.length !== item.subSeriesList.length
  ) {
    throw new BadRequest(
      `ValidationError: Invalid subSeriesList provided for ${item.groupName}.`
    );
  }
  /**
   * @description Insert/activate mappings for the new group
   */
  await groupNamcLineSeriesMapperService.insertMappingsForNewGroup(
    groupId,
    namcLineSeriesIds,
    userEmail,
    tx
  );
  return groupId;
}

module.exports = {
  upsertGroupsNStepStatus,
};
