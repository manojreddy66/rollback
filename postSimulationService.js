/**
 * @description this file contains POST Simulation service methods
 */

const { BadRequest } = require("utils/api_response_utils");
const { validateRequestBody } = require("./validateRequest");
const { postSimulationData } = require("./postSimulation");
const { prepareResponse } = require("./utils");

/**
 * @description Function to validate request, insert simulation DB rows and return response
 * @param {Object} event - Lambda event
 * @returns {Promise<Object>} success response with message and simulation data
 */
async function createSimulation(event) {
  try {
    const reqPayload = event?.body ? JSON.parse(event.body) : {};
    console.log("requestBody:", reqPayload);
    /**
     * @description Function to validate input request body
     * @param {Object} reqPayload: API input request body
     * @returns {Promise<Object>} errorMessages - Validation errors if any
     */
    const { errorMessages } = await validateRequestBody(reqPayload);
    /* Check for validation errors */
    if (errorMessages.length > 0) {
      throw new BadRequest(errorMessages);
    }
    /**
     * @description Bulk insert simulation data into DB, insert simulation logs
     * and invoke step function for each simulation
     * @param {Object} reqPayload - validated request body
     * @returns {Promise<void>} void if successful
     */
    await postSimulationData(reqPayload);
    /**
     * @description Prepare and return success response
     */
    return prepareResponse();
  } catch (err) {
    console.log("Error in createSimulation:", err);
    throw err;
  }
}

module.exports = {
  createSimulation,
};
