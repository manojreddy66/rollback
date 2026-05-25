/**
 * @description this file contains Rollback Simulation service methods
 */

const { BadRequest } = require("utils/api_response_utils");
const { validateRequestBody } = require("./validateRequest");
const { rollbackSimulationData } = require("./rollbackSimulation");
const { prepareResponse } = require("./utils");

/**
 * @description Function to validate request, rollback simulation and return response
 * @param {Object} event - Lambda event
 * @returns {Promise<Object>} success response with message
 */
async function rollbackSimulation(event) {
  try {
    const reqPayload = event?.body ? JSON.parse(event.body) : {};
    console.log("requestBody:", reqPayload); 
    /**
     * @description Function to validate input request body
     * @param {Object} reqPayload: API input request body
     * @returns {Promise<Object>} errorMessages - Validation errors if any & simulationDetails
     */
    const { errorMessages, simulationDetails } =
      await validateRequestBody(reqPayload); 
    /* Check for validation errors */
    if (errorMessages.length > 0) {
      throw new BadRequest(errorMessages);
    } 
    /**
     * @description Rollback simulation data in DB
     * @param {Object} reqPayload - Validated request body
     * @param {Object} simulationDetails - Simulation data
     * @returns {Promise<void>} Void if successful
     */
    await rollbackSimulationData(reqPayload, simulationDetails); 
    /**
     * @description Prepare and return success response
     */
    return prepareResponse();
  } catch (err) {
    console.log("Error in rollbackSimulation:", err);
    throw err;
  }
}

module.exports = {
  rollbackSimulation,
};
