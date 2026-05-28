/**
 * @description This file contains routing to input validation, DB operations and prepare response
 */

const { BadRequest } = require("utils/api_response_utils");
const { validateInput } = require("./validateRequest");
const { deleteScenarioData } = require("./deleteScenario");
const { prepareResponse } = require("./utils");

/**
 * @description Function to validate & delete scenario.
 * @param {Object} event: API request
 * @returns {Promise<Object>} response - delete scenario success response
 */
async function deleteScenario(event) {
  try {
    const body = JSON.parse(event?.body || "{}");
    /**
     * @description Function to validate input request parameters.
     * @param {Object} body: Input request payload
     * @returns {Object} errorMessages - Array of validation error messages, if any.
     */
    const { errorMessages } = await validateInput(body);
    // Check for validation errors
    if (errorMessages?.length) {
      throw new BadRequest(errorMessages);
    }
    /**
     * @description Function to delete scenario.
     * @param {Object} body: Input request payload
     */
    await deleteScenarioData(body);
    /**
     * @description Function to prepare response
     * @returns {Object}: success message
     */
    return prepareResponse();
  } catch (err) {
    console.log("Error in deleteScenario:", err);
    throw err;
  }
}

module.exports = { deleteScenario };
