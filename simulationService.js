const { BaseService } = require("./BaseService");
const { Prisma } = require("@prisma/client");

class simulationData extends BaseService {
  constructor(db) {
    super(db);
  }

  /**
   * @description Get simulation data by simulationId
   * @param {string} simulationId: UUID of the simulation
   * @returns {Array} simulation data
   */
  async getSimulationById(simulationId) {
    try {
      return await this.prisma.$queryRaw`
        SELECT *
        FROM supply_planning.simulation
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true;
      `;
    } catch (error) {
      console.log("Error in getSimulationById:", error);
      throw error;
    }
  }

  /**
   * @description Function to fetch max rerun_count or -1 by group_id for a scenario
   * @param {String} scenarioId - scenario id
   * @param {Array} groupIds - unique group ids
   * @param {Object} tx - Prisma transaction client
   * @returns {Array} groupData - [{ groupId, maxRerun }]
   */
  async getMaxRerunByGroups(scenarioId, groupIds, tx = this.prisma) {
    try {
      return await tx.$queryRaw`
        SELECT
          group_id AS "groupId",
          COALESCE(MAX(rerun_count), -1)::integer AS "maxRerun"
        FROM supply_planning.simulation
        WHERE scenario_id = ${scenarioId}::uuid
          AND group_id IN (${Prisma.join(
            groupIds.map((groupId) => Prisma.sql`${groupId}::uuid`)
          )})
        GROUP BY group_id;
      `;
    } catch (err) {
      console.log("Error in getMaxRerunByGroups:", err);
      throw err;
    }
  }

  /**
   * @description Function to insert prepared simulation rows
   * @param {String} scenarioId - scenario id
   * @param {String} userEmail - user email
   * @param {String} userName - user name
   * @param {String} simulationStatus - initial simulation status
   * @param {String} activityLog - activity log JSON string
   * @param {Array} data - [{ groupId, rerunCount, simulationScenarioName }]
   * @param {Object} tx - Prisma transaction client
   * @returns {Promise<Array>} inserted simulation rows
   */
  async insertSimulationData(
    scenarioId,
    userEmail,
    userName,
    simulationStatus,
    activityLog,
    data,
    tx = this.prisma
  ) {
    try {
      const insertValues = Prisma.join(
        data.map(
          (row) =>
            Prisma.sql`(
            ${scenarioId}::uuid,
            ${row.groupId}::uuid,
            ${row.simulationScenarioName}::text,
            ${row.rerunCount}::integer,
            ${simulationStatus}::text,
            ${'""'}::jsonb,
            ${activityLog}::jsonb,
            TRUE,
            ${userName}::text,
            ${userEmail}::text
          )`
        )
      );

      return await tx.$queryRaw`
        INSERT INTO supply_planning.simulation (
          scenario_id,
          group_id,
          simulation_scenario_name,
          rerun_count,
          simulation_status,
          key_input_parameters,
          activity_log,
          is_active,
          created_by_user_name,
          created_by
        )
        VALUES ${insertValues}
        RETURNING
          simulation_id::uuid AS "simulationId",
          scenario_id::uuid AS "scenarioId",
          group_id::uuid AS "groupId",
          rerun_count AS "rerunCount",
          simulation_scenario_name AS "simulationScenarioName",
          simulation_status AS "simulationStatus";
      `;
    } catch (err) {
      console.log("Error in insertSimulationData:", err);
      throw err;
    }
  }
  /**
   * @description Function to update key_input_parameters for a simulation
   * @param {String} simulationId - simulation UUID
   * @param {String} keyInputParameters - JSON string of key input parameters
   * @param {Object} tx - Prisma transaction client
   * @returns {Promise<Object>} - update result
   */
  async updateKeyInputParameters(
    simulationLogDetails,
    dsStepFunctionPayload,
    tx = this.prisma
  ) {
    try {
      return await tx.$queryRaw`
        UPDATE supply_planning.simulation
        SET key_input_parameters = ${dsStepFunctionPayload}::jsonb
        WHERE simulation_id in (${Prisma.join(simulationLogDetails.map((item) => Prisma.sql`${item.simulationId}::uuid`))})
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in updateKeyInputParameters:", err);
      throw err;
    }
  }

  /**
   * @description Function to update simulation status to "Submitted For Review"
   * @param {String} simulationId - simulation id from input
   * @param {String} userName - user name from input
   * @param {String} userEmail - user email from input
   * @param {String} activityLog - updated activity log JSON string
   * @returns {Promise<Object>} - update result
   */
  async submitSimulationForReview(
    simulationId,
    userName,
    userEmail,
    activityLog
  ) {
    try {
      return await this.prisma.$queryRaw`
        UPDATE supply_planning.simulation
        SET simulation_status = 'Submitted For Review',
            last_updated_timestamp = CURRENT_TIMESTAMP,
            updated_by_user_name = ${userName}::text,
            updated_by = ${userEmail}::text,
            activity_log = ${activityLog}::jsonb
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in submitSimulationForReview:", err);
      throw err;
    }
  }

  /**
   * @description Function to update rundown status (Approved/Promoted/Rejected)
   * @param {String} simulationId - simulation UUID
   * @param {String} status - new status (Approved/Promoted/Rejected)
   * @param {String|null} reviewComments - review comments (required for Rejected)
   * @param {String} userName - user name for audit
   * @param {String} userEmail - user email for audit
   * @param {String} activityLog - updated activity log JSON string
   * @returns {Promise<Object>} - update result
   */
  async updateRundownStatus(
    simulationId,
    status,
    reviewComments,
    userName,
    userEmail,
    activityLog
  ) {
    try {
      return await this.prisma.$queryRaw`
        UPDATE supply_planning.simulation
        SET simulation_status = ${status}::text,
            simulation_comment = ${reviewComments}::text,
            last_updated_timestamp = CURRENT_TIMESTAMP,
            updated_by_user_name = ${userName}::text,
            updated_by = ${userEmail}::text,
            activity_log = ${activityLog}::jsonb
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in updateRundownStatus:", err);
      throw err;
    }
  }

  /**
   * @description Function to get all active simulations by scenarioId
   * @param {String} scenarioId - scenario UUID
   * @returns {Array} simulation records
   */
  async getSimulationsByScenarioId(scenarioId) {
    try {
      return await this.prisma.$queryRaw`
        SELECT *
        FROM supply_planning.simulation
        WHERE scenario_id = ${scenarioId}::uuid
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in getSimulationsByScenarioId:", err);
      throw err;
    }
  }

  /**
   * @description Function to soft-delete a simulation rundown by setting is_active = false.
   * Also updates updated_by_user_name, updated_by, activity_log and last_updated_timestamp.
   * @param {String} simulationId - simulation UUID
   * @param {String} userName - user name for audit
   * @param {String} userEmail - user email for audit
   * @param {String} activityLog - updated activity log JSON string
   * @returns {Number} number of rows affected
   */
  async deactivateSimulationRundown(
    simulationId,
    userName,
    userEmail,
    activityLog
  ) {
    try {
      return await this.prisma.$executeRaw`
        UPDATE supply_planning.simulation
        SET
          is_active = false,
          last_updated_timestamp = CURRENT_TIMESTAMP,
          updated_by_user_name = ${userName}::text,
          updated_by = ${userEmail}::text,
          activity_log = ${activityLog}::jsonb
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in deactivateSimulationRundown:", err);
      throw err;
    }
  }

  /**
   * @description Function to fetch all active simulation rows for a given scenario
   * @param {String} scenarioId - scenario id
   * @returns {Array} simulation rows
   */
  async getRundownsByScenarioId(scenarioId) {
    try {
      return await this.prisma.$queryRaw`
        SELECT
          simulation_id::uuid AS "simulationId",
          simulation_scenario_name AS "simulationScenarioName",
          last_updated_timestamp AS "lastUpdatedTimestamp",
          created_by_user_name AS "createdByUserName",
          updated_by_user_name AS "updatedByUserName",
          created_by AS "createdBy",
          updated_by AS "updatedBy",
          simulation_status AS "simulationStatus",
          comments AS "comments",
          activity_log AS "activityLog",
          error_messages AS "errorMessages"
        FROM supply_planning.simulation
        WHERE scenario_id = ${scenarioId}::uuid
          AND is_active = TRUE;
      `;
    } catch (err) {
      console.log("Error in getRundownsByScenarioId:", err);
      throw err;
    }
  }

  /**
   * @description Function to fetch rundown comments by simulationId
   * @param {String} simulationId - simulation UUID
   * @returns {Promise<Array>} comments data for the given simulationId
   */
  async getRundownCommentsById(simulationId) {
    try {
      return await this.prisma.$queryRaw`
        SELECT comments
        FROM supply_planning.simulation
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = TRUE;
      `;
    } catch (err) {
      console.log("Error in getRundownCommentsById:", err);
      throw err;
    }
  }

  /**
   * @description Function to update rundown comments for a simulation
   * @param {String} simulationId - simulation UUID
   * @param {String} userEmail - user email for audit
   * @param {String} userName - user name for audit
   * @param {Array} comments - comments array to store
   * @returns {Array} - updated simulation row with simulation_id
   */
  async updateRundownComments(simulationId, userEmail, userName, comments) {
    try {
      return await this.prisma.$queryRaw`
        UPDATE supply_planning.simulation
        SET comments = ${JSON.stringify(comments)}::jsonb,
            last_updated_timestamp = CURRENT_TIMESTAMP,
            updated_by = ${userEmail}::text,
            updated_by_user_name = ${userName}::text
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true
        RETURNING simulation_id;
      `;
    } catch (err) {
      console.log("Error in updateRundownComments:", err);
      throw err;
    }
  }

  /**
   * @description Function to fetch report data by simulationId and year from a specific report table
   * @param {String} simulationId - simulation UUID
   * @param {String} year - model year
   * @param {String} tableName - report table name (e.g., monthly, daily_inventory)
   * @returns {Promise<Array>} report data rows
   */
  async getReportData(simulationId, year, tableName) {
    try {
      const vanningDateTables = [
        "timeline_report",
        "osp_report",
        "inventory_daily_report",
      ];
      let yearFilter;
      if (vanningDateTables.includes(tableName)) {
        yearFilter = Prisma.sql`vanning_date::text LIKE ${year + "%"}`;
      } else if (tableName === "subseries_detail_report") {
        yearFilter = Prisma.sql`model_year = ${year}::text`;
      } else {
        yearFilter = Prisma.sql`year_month LIKE ${year + "%"}`;
      }
      return await this.prisma.$queryRaw`
        SELECT * FROM supply_planning.${Prisma.raw(tableName)}
        WHERE simulation_id = ${simulationId}::uuid
          AND ${yearFilter};
      `;
    } catch (err) {
      console.log("Error in getReportData:", err);
      throw err;
    }
  }

  /**
   * @description Function to update activity log for a simulation
   * @param {String} simulationId - simulation UUID
   * @param {String} userEmail - user email for audit
   * @param {String} activityLog - updated activity log JSON string
   * @returns {Promise<Object>} update result
   */
  async updateActivityLog(simulationId, userEmail, activityLog) {
    try {
      return await this.prisma.$queryRaw`
        UPDATE supply_planning.simulation
        SET last_updated_timestamp = CURRENT_TIMESTAMP,
            updated_by = ${userEmail}::text,
            activity_log = ${activityLog}::jsonb
        WHERE simulation_id = ${simulationId}::uuid
          AND is_active = true;
      `;
    } catch (err) {
      console.log("Error in updateActivityLog:", err);
      throw err;
    }
  }
}

module.exports.simulationData = simulationData;
