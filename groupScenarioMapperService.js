const { BaseService } = require("./BaseService");
const { Prisma } = require("@prisma/client");

class groupScenarioMapperData extends BaseService {
  constructor(db) {
    super(db);
  }

  /**
   * @description Function to validate groupIds exist in group_scenario_mapper for a scenario
   * @param {String} scenarioId - scenario id
   * @param {Array} groupIds - unique group ids
   * @returns {Array} active groupIds [{ groupId }]
   */
  async getGroupScenarioMapperData(scenarioId, groupIds) {
    try {
      return await this.prisma.$queryRaw`
        SELECT group_id AS "groupId"
        FROM supply_planning.group_scenario_mapper
        WHERE scenario_id = ${scenarioId}::uuid
          AND group_id IN (${Prisma.join(
            groupIds.map((groupId) => Prisma.sql`${groupId}::uuid`)
          )})
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in getGroupScenarioMapperData:", err);
      throw err;
    }
  }

  /**
   * @description Function to bulk deactivate scenario links in group_scenario_mapper for update rows
   * @param {String} scenarioId - scenario UUID
   * @param {Array} groupScenarioMapIds - existing grp_scenario_mp_id values
   * @param {String} userEmail - user email for audit
   * @param {Object} tx - prisma transaction client
   * @returns {Promise<Number>} rows affected
   */
  async deactivateScenarioLinks(
    scenarioId,
    groupScenarioMapIds,
    userEmail,
    tx = this.prisma
  ) {
    try {
      return await tx.$executeRaw(
        Prisma.sql`
          UPDATE supply_planning.group_scenario_mapper sgm
          SET
            is_active = FALSE,
            last_updated_timestamp = NOW(),
            updated_by = ${userEmail}::text
          FROM (
            VALUES
            ${Prisma.join(
              groupScenarioMapIds.map((id) => Prisma.sql`(${id}::uuid)`)
            )}
          ) AS v(grp_scenario_mp_id)
          WHERE sgm.grp_scenario_mp_id = v.grp_scenario_mp_id
            AND sgm.scenario_id = ${scenarioId}::uuid
            AND sgm.is_active = TRUE;
        `
      );
    } catch (err) {
      console.log("Error in deactivateScenarioLinks:", err);
      throw err;
    }
  }

  /**
   * @description Function to bulk upsert scenario links into group_scenario_mapper
   * @param {Array} linksData - array of { scenarioId, groupId, groupName, userEmail }
   * @param {Object} tx - prisma transaction client
   * @returns {Promise<Number>} rows affected
   */
  async upsertScenarioLinksBulk(linksData, tx = this.prisma) {
    try {
      if (!linksData || linksData.length === 0) {
        return 0;
      }

      return await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO supply_planning.group_scenario_mapper (
            scenario_id,
            group_id,
            group_name,
            is_active,
            created_by
          )
          VALUES
          ${Prisma.join(
            linksData.map(
              (item) => Prisma.sql`(
              ${item.scenarioId}::uuid,
              ${item.groupId}::uuid,
              ${item.groupName}::text,
              TRUE,
              ${item.userEmail}::text
            )`
            )
          )}
          ON CONFLICT (scenario_id, group_id, group_name)
          DO UPDATE SET
            is_active = TRUE,
            last_updated_timestamp = NOW(),
            updated_by = EXCLUDED.created_by;
        `
      );
    } catch (err) {
      console.log("Error in upsertScenarioLinksBulk:", err);
      throw err;
    }
  }

  /**
   * @description Function to validate groupName uniqueness exist in group_scenario_mapper for a scenario
   * @param {String} scenarioId - scenario id
   * @param {Array} groupNames - unique group names
   * @param {Array} excludeGroupScenarioMapIds - group scenario map ids to exclude from validation
   * @returns {Array} Active groupNames [{ groupName }] existing for the scenario,
   * excluding the provided group scenario map ids
   */
  async getExistingGroupNames(
    scenarioId,
    groupNames,
    excludeGroupScenarioMapIds
  ) {
    try {
      const condition =
        excludeGroupScenarioMapIds && excludeGroupScenarioMapIds.length > 0
          ? Prisma.sql`AND grp_scenario_mp_id NOT IN (${Prisma.join(
              excludeGroupScenarioMapIds.map((id) => Prisma.sql`${id}::uuid`)
            )})`
          : Prisma.empty;
      return await this.prisma.$queryRaw`
        SELECT group_name AS "groupName" FROM supply_planning.group_scenario_mapper 
        WHERE scenario_id = ${scenarioId}::uuid AND group_name IN (${Prisma.join(
          groupNames.map((groupName) => Prisma.sql`${groupName}::text`)
        )}) ${condition} AND is_active = TRUE 
      `;
    } catch (err) {
      console.log("Error in getExistingGroupNames:", err);
      throw err;
    }
  }
}

module.exports.groupScenarioMapperData = groupScenarioMapperData;
