/**
 * @name rollback-rundown
 * @description Returns success message after rolling back rundown
 * @createdOn May 20th, 2026
 * @author Priyadarshini Gangone
 * @modifiedBy
 * @modifiedOn
 * @modificationSummary
 */

const {
  sendResponse,
  BadRequest,
  HTTP_RESPONSE_CODES,
} = require("utils/api_response_utils");
const { rollbackSimulation } = require("./rollbackSimulationService");
const { API_ERROR_MESSAGE } = require("constants/customConstants");

/**
 * @description Lambda handler for Rollback Rundown POST API.
 * @param {Object} event: API event with request body:
  {
    "simulationId": "uuid",
    "userEmail": "gangone.priyadarshini@toyota.com"
  }
 * @returns {Promise<Object>}: response sample is detailed below.
 * Success response with status code 200:
 * {
    "message": "Successfully rolled back rundown to draft state."
   }
 * In-valid input error with status 400:
  {
    "errorMessage": [<"ValidationError: validation error message">]
  }
 * Internal server error with status code 500:
  {
    "errorMessage": "Internal Server Error"
  }
 */
exports.handler = async (event) => {
  try {
    /**
     * @description Function to validate input and rollback simulation.
     * @param {Object} event: Input parameters
     * @returns {Promise<Object>} successResponse - success response
     */
    const successResponse = await rollbackSimulation(event);
    console.log("Rollback Simulation Response:", successResponse);
    return sendResponse(HTTP_RESPONSE_CODES.SUCCESS, successResponse);
  } catch (error) {
    console.log("Handler Error - Rollback Simulation Post API:", error);
    let errorMessage = API_ERROR_MESSAGE.INTERNAL_SERVER_ERROR;
    let statusCode = HTTP_RESPONSE_CODES.INTERNAL_SERVER_ERROR;
    /** If validation errors exist */
    if (error instanceof BadRequest) {
      statusCode = HTTP_RESPONSE_CODES.BAD_REQUEST;
      errorMessage = error.message
        .split(/,(?=ValidationError:)/)
        .map((e) => e.trim());
      console.log(
        "Validation error messages - Rollback Simulation Post API:",
        errorMessage
      );
    }
    return sendResponse(statusCode, { errorMessage });
  }
};
