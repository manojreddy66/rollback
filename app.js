/**
 * @name delete-scenario
 * @description Returns success message after deleting (soft-deleting) a scenario
 * @createdOn Feb 26th, 2026
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
const { deleteScenario } = require("./deleteScenarioService");
const { API_ERROR_MESSAGE } = require("constants/customConstants");

/**
 * @description Lambda handler for delete scenario.
 *@param {Object} event: API event with body:
    {
      "scenarioId": "Getsudo/TMMI/Line1_Cycle_V1",
      "userEmail": "gangone.priyadarshini@toyota.com"
    }
 ** @returns {Promise<Object>}: response sample is detailed below.
 *  Response object sample for success response with status code 200.
 * {
     "message": "Successfully deleted scenario."
 * }
 * In-valid input error with status 400:
    {
      "errorMessage": [<"ValidationError: validation error message”>]
    }
 * Response object sample for any internal server error with status code 500.
    {
      "errorMessage": <"Internal Server Error">
    }
  * HTTP_RESPONSE_CODES info:
    {
      SUCCESS: 200,
      VALIDATION_ERROR: 400,
      INTERNAL_SERVER_ERROR: 500
    }
*/
exports.handler = async (event) => {
  try {
    /**
     * @description Function to validate & delete scenario.
     * @param {Object} event: Input request
     * @returns {Object} deleteResponse - Success message
     */
    const deleteResponse = await deleteScenario(event);
    console.log("response:", deleteResponse);
    return sendResponse(HTTP_RESPONSE_CODES.SUCCESS, deleteResponse);
  } catch (error) {
    console.log("Handler Error:", error);
    let errorMessage = API_ERROR_MESSAGE.INTERNAL_SERVER_ERROR;
    let statusCode = HTTP_RESPONSE_CODES.INTERNAL_SERVER_ERROR;
    if (error instanceof BadRequest) {
      statusCode = HTTP_RESPONSE_CODES.BAD_REQUEST;
      errorMessage = error.message
        .split(/,(?=ValidationError:)/)
        .map((e) => e.trim());
      console.log("Validation error messages: ", errorMessage);
    }
    return sendResponse(statusCode, { errorMessage });
  }
};
