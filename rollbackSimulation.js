/**
 * @description This file contains DB operations to rollback simulation details.
 */

const { dbConnect } = require("prismaORM/index");
const { simulationData } = require("prismaORM/services/simulationService");
const { SIMULATION_STATUSES } = require("constants/customConstants");
const { getCurrentTimestamp } = require("utils/common_utils");

/**
 * @description Function to rollback simulation status.
 * @param {Object} body - Request payload containing simulationId, userName and userEmail
 * @param {Object} simulationDetails - Simulation data
 * @returns {Promise<void>} void if successful
 */
async function rollbackSimulationData(body, simulationDetails) {
  const rdb = await dbConnect();
  const simulationDataService = new simulationData(rdb);
  try {
    const { simulationId, userName, userEmail } = payload;
    /**
     * @description Build updated activity log by appending submit for review entry
     */
    const updatedActivityLog = createLatestActivityLog(
      simulationDetails,
      userName
    );
    /**
     * @description Update simulation status back to Completed for the given simulationId
     */
    await simulationDataService.rollbackSimulationRundown(
      simulationId,
      userName,
      userEmail,
      SIMULATION_STATUSES.COMPLETED,
      updatedActivityLog
    );
  } catch (err) {
    console.log("Error in rollbackSimulationData:", err);
    throw err;
  }
}

/**
 * @description Function to append a new entry to activity log when a simulation is rolledback
 * @param {*} simulationDetails - existing simulation details from DB (includes existing activity_log)
 * @param {*} userName - name of the user performing the rollback action
 * @returns Updated activity log as a JSON string
 */
function createLatestActivityLog(simulationDetails, userName) {
  const existingLog = simulationDetails.activity_log || [];
  /* Get current CT timestamp */
  const timestamp = getCurrentTimestamp();
  const simulationName = simulationDetails.simulation_scenario_name;
  const newLogEntry = `User ${userName} has rolled back the simulation ${simulationName} to draft state on ${timestamp}`;
  return JSON.stringify([...existingLog, newLogEntry]);
}

module.exports = {
  rollbackSimulationData,
};
