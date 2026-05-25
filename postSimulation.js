/**
 * @description This file contains DB operations to bulk insert simulation details.
 */

const { dbConnect } = require("prismaORM/index");
const { simulationData } = require("prismaORM/services/simulationService");
const {
  simulationLogData,
} = require("prismaORM/services/simulationLogService");
const { scenariosData } = require("prismaORM/services/scenariosService");
const { SCENARIO_STEP_STATUSES } = require("constants/customConstants");
const { getCurrentTimestamp } = require("utils/common_utils");
const { initiateStepFunctionExecution } = require("utils/step_function_utils");

/**
 * @description Function to bulk insert simulation details within a transaction.
 * Fetches existing rerun counts per group, formats data with versioning,
 * inserts all simulation rows, inserts simulation logs, updates key_input_parameters,
 * updates scenario status, and invokes step function.
 * @param {Object} body - request payload containing scenarioId, userEmail, userName, data[]
 * @returns {Promise<void>} void if successful
 */
async function postSimulationData(body) {
  const rdb = await dbConnect();
  const simulationDataService = new simulationData(rdb);
  const simulationLogDataService = new simulationLogData(rdb);
  const scenariosDataService = new scenariosData(rdb);
  try {
    return await rdb.prisma.$transaction(async (tx) => {
      /**
       * @description Fetch existing rerun counts by groupId and format bulk insert data
       * @param {Object} body - request payload
       * @param {Object} simulationDataService - simulation prisma service instance
       * @param {Object} tx - Prisma transaction client
       * @returns {Promise<Array>} formattedInsertData - formatted rows for bulk insert
       */
      const formattedInsertData = await createBulkInsertSimulationData(
        body,
        simulationDataService,
        tx
      );
      const simulationLogDetails = await insertSimulationAndLogData(
        formattedInsertData,
        body,
        simulationDataService,
        simulationLogDataService,
        tx
      );
      /**
       * @description Function to create payload for DS Simulation Step Function execution
       */
      const dsStepFunctionPayload = createStepFunctionPayload(
        body,
        simulationLogDetails
      );
      /**
       * @description Update simulation with DS payload & scenarios table
       */
      await updateSimulationKeyInputNScenarioStatus(
        simulationLogDetails,
        dsStepFunctionPayload,
        simulationDataService,
        scenariosDataService,
        tx
      );
      /**
       * @description Build step function payload and invoke DS Simulation Step Function
       */
      await initiateStepFunctionExecution({
        stateMachineArn: process.env.DS_SIMULATION_STEP_FUNCTION_ARN,
        name: `${body.scenarioId}-${Date.now()}`,
        input: JSON.stringify(dsStepFunctionPayload),
      });
    });
  } catch (err) {
    console.log("Error in postSimulationData:", err);
    throw err;
  }
}

/**
 * @description Function to insert simulation log for each simulation and collect jobIds
 * @param {Array} insertedData - inserted simulation rows
 * @param {String} scenarioId - scenario UUID
 * @param {String} userName - user name
 * @param {String} userEmail - user email
 * @param {Object} simulationLogDataService - simulation log prisma service instance
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Array>} insertedData with jobId appended
 */
async function insertSimulationLogs(
  insertedData,
  scenarioId,
  userName,
  userEmail,
  simulationLogDataService,
  tx
) {
  const payload = insertedData.map((item) => ({
    scenarioId,
    simulationId: item.simulationId,
    userName,
    userEmail,
  }));
  /**
   * @description Bulk insert simulation log entries in a single DB query
   * @returns {Promise<Array>} logResults - [{ simulationId, jobId }]
   */
  const simulationLogResults =
    await simulationLogDataService.insertSimulationLog(payload, tx);
  console.log("Inserted simulation log count:", simulationLogResults.length);
  return simulationLogResults;
}

/**
 * @description Function to fetch existing rerun counts and format data for bulk insert.
 * Queries the simulation table for max rerun_count per groupId,
 * then formats each row with the next version number.
 * @param {Object} body - request payload containing scenarioId, data[]
 * @param {Object} simulationDataService - simulation prisma service instance
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Array>} formattedData - [{ groupId, rerunCount, simulationScenarioName }]
 */
async function createBulkInsertSimulationData(body, simulationDataService, tx) {
  /**
   * @description Extract unique groupIds from request data to avoid duplicate fetches
   */
  const uniqueGroupIds = [...new Set(body.data.map((row) => row.groupId))];
  /**
   * @description Fetch max rerun_count per groupId from simulation table
   * Returns [{ groupId, maxRerun }] where maxRerun is -1 if no existing rows
   */
  const existingReruns = await simulationDataService.getMaxRerunByGroups(
    body.scenarioId,
    uniqueGroupIds,
    tx
  );
  return formatBulkInsertData(existingReruns, body.data);
}

/**
 * @description Function to format data for bulk insert with rerun versioning.
 * For each row, computes the next rerun_count based on existing max rerun per groupId.
 * Generates simulation_scenario_name as "{vanningCenter} {subSeriesList} - V{version}".
 * Handles multiple rows with the same groupId by incrementing rerun sequentially.
 * @param {Array} existingReruns - [{ groupId, maxRerun }] from DB
 * @param {Array} data - request data array [{ groupId, vanningCenter, subSeriesList }]
 * @returns {Array} formattedData - [{ groupId, rerunCount, simulationScenarioName }]
 */
function formatBulkInsertData(existingReruns, data) {
  /**
   * @description Build a lookup map: groupId -> current max rerun_count
   */
  const rerunByGroupId = new Map(
    existingReruns.map((row) => [row.groupId, Number(row.maxRerun)])
  );
  return data.map((row) => {
    /**
     * @description Get current max rerun for this groupId (-1 if no existing rows)
     * and compute the next rerun_count
     */
    const currentRerun = rerunByGroupId.has(row.groupId)
      ? rerunByGroupId.get(row.groupId)
      : -1;
    const nextRerun = currentRerun + 1;
    /**
     * @description Update the map so subsequent rows with same groupId get incremented version
     */
    rerunByGroupId.set(row.groupId, nextRerun);
    /**
     * @description Generate simulation_scenario_name: "{vanningCenter} {subSeriesList} - V{version}"
     * Version is 1-based (nextRerun + 1)
     */
    const subSeriesText = row.subSeriesList.join(", ");
    const simulationScenarioName = `${row.vanningCenter} ${subSeriesText} - V${nextRerun + 1}`;
    return {
      groupId: row.groupId,
      rerunCount: nextRerun,
      simulationScenarioName,
    };
  });
}

/**
 * @description Function to insert simulation data and corresponding log entries,
 * then merge results with request data to produce the full enriched response shape.
 * @param {Array} formattedInsertData - array of formatted simulation data for insertion
 * @param {Array} requestData - original request data array with vanningCenter and subSeriesList per group
 * @param {Object} simulationDataService - service to interact with simulation data
 * @param {Object} simulationLogDataService - service to interact with simulation log data
 * @param {Object} tx - Prisma transaction client
 * @returns {Promise<Array>} Enriched array with groupId, vanningCenter, subSeriesList, simulationId, jobId
 */
async function insertSimulationAndLogData(
  formattedInsertData,
  body,
  simulationDataService,
  simulationLogDataService,
  tx
) {
  const { scenarioId, userEmail, userName } = body;
  /**
   * @description Build updated activity log by appending delete entry
   */
  const activityLog = createLatestActivityLog(userName);
  /**
   * @description Insert all formatted simulation rows into DB
   * @returns {Promise<Array>} insertedData - array of inserted simulation records
   */
  const insertedData = await simulationDataService.insertSimulationData(
    scenarioId,
    userEmail,
    userName,
    SCENARIO_STEP_STATUSES.NOT_STARTED,
    activityLog,
    formattedInsertData,
    tx
  );
  /**
   * @description Insert simulation log entries for each simulation and collect jobIds
   * @returns {Promise<Array>} insertedData with simulationId and jobId
   */
  const simulationLogResults = await insertSimulationLogs(
    insertedData,
    scenarioId,
    userName,
    userEmail,
    simulationLogDataService,
    tx
  );
  /**
   * @description Map 1: simulationId -> jobId (from simulationLogResults)
   */
  const jobBySimId = new Map(
    simulationLogResults.map((r) => [r.simulationId, r.jobId])
  );
  /**
   * @description Map 2: groupId -> { vanningCenter, subSeriesList } (from body.data)
   * vanningCenter and subSeriesList are invariant per groupId across reruns.
   */
  const groupDataByGroupId = new Map(
    body.data.map((r) => [
      r.groupId,
      { vanningCenter: r.vanningCenter, subSeriesList: r.subSeriesList },
    ])
  );
  /**
   * @description Final merge: for each inserted simulation row,
   * resolve jobId via simulationId and vanningCenter/subSeriesList via groupId.
   */
  return insertedData.map((row) => {
    const groupData = groupDataByGroupId.get(row.groupId);
    return {
      groupId: row.groupId,
      vanningCenter: groupData?.vanningCenter,
      subSeriesList: groupData?.subSeriesList,
      simulationId: row.simulationId,
      jobId: jobBySimId.get(row.simulationId),
    };
  });
}

/**
 * @description Function to append a new entry to activity log when a rundown is started
 * @param {*} userName - name of the user performing the start action
 * @returns Updated activity log as a JSON string
 */
function createLatestActivityLog(userName) {
  /* Get current CT timestamp */
  const timestamp = getCurrentTimestamp();
  const newLogEntry = `User ${userName} has started the rundown on ${timestamp}`;
  return JSON.stringify([newLogEntry]);
}

/**
 * @description Function to create payload for DS Simulation Step Function execution
 * @param {Object} body: Request input
 * @param {*} simulationLogDetails: details of the simulation log
 * @returns {Object} payload for DS Simulation Step Function execution
 */
function createStepFunctionPayload(body, simulationLogDetails) {
  const { scenarioId, userEmail, userName } = body;
  return {
    scenarioId,
    userName,
    userEmail,
    data: simulationLogDetails,
  };
}

/**
 * @description Function to update key input parameters for newly created simulations
 * and update scenario status to In Progress if not already.
 * @param {*} simulationLogDetails - details of the inserted simulation logs
 * @param {*} dsStepFunctionPayload - payload for DS Simulation Step Function execution
 * @param {*} simulationDataService - service to interact with simulation data
 * @param {*} scenariosDataService - service to interact with scenario data
 * @param {*} tx - Prisma transaction client
 * @returns {Promise<Array>} simulationLogDetails
 */
async function updateSimulationKeyInputNScenarioStatus(
  simulationLogDetails,
  dsStepFunctionPayload,
  simulationDataService,
  scenariosDataService,
  tx
) {
  /**
   * @description Update key input parameters for the scenario based on the new simulations.
   * This ensures that the scenario's key input parameters reflect the latest simulation configurations.
   * @param {Object} simulationLogDetails - details of the inserted simulation logs
   * @param {Object} dsStepFunctionPayload - payload for DS Simulation Step Function execution
   * @param {Object} tx - Prisma transaction client
   */
  await simulationDataService.updateKeyInputParameters(
    simulationLogDetails,
    dsStepFunctionPayload,
    tx
  );
  /**
   * @description Update scenario status to In Progress (no-op if already In Progress)
   */
  await scenariosDataService.updateScenarioStatus(
    dsStepFunctionPayload.scenarioId,
    dsStepFunctionPayload.userEmail,
    SCENARIO_STEP_STATUSES.IN_PROGRESS,
    tx
  );
  return simulationLogDetails;
}

module.exports = {
  postSimulationData,
};
