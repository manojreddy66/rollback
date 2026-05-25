/**
 * @name simulation
 * @description Returns success message after bulk inserting simulation details
 * @createdOn Apr 10th, 2026
 * @modifiedBy
 * @modifiedOn
 * @modificationSummary
 */

const {
  sendResponse,
  BadRequest,
  HTTP_RESPONSE_CODES,
} = require("utils/api_response_utils");
const { createSimulation } = require("./postSimulationService");
const { API_ERROR_MESSAGE } = require("constants/customConstants");

/**
 * @description Lambda handler for Post Run Simulation API.
 * @param {Object} event: API event with request body:
  {
    "scenarioId": "uniqueScenarioId",
    "userEmail": "user@toyota.com",
    "userName": "User Name",
    "data": [
      {
        "groupId": "uniqueGroupId",
        "vanningCenter": "TMK",
        "subSeriesList": ["CAMRY", "RAV4 Gas"]
      }
    ]
  }
 * @returns {Promise<Object>}: response sample is detailed below.
 * Success response with status code 200:
 * {
    "message": "Successfully initiated simulation."
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
     * @description Function to validate input and insert simulation data.
     * @param {Object} event: Input parameters
     * @returns {Promise<Object>} successResponse - success response with simulation details
     */
    const successResponse = await createSimulation(event);
    console.log("Post Simulation Response:", successResponse);
    return sendResponse(HTTP_RESPONSE_CODES.SUCCESS, successResponse);
  } catch (error) {
    console.log("Handler Error - Simulation Post API:", error);
    let errorMessage = API_ERROR_MESSAGE.INTERNAL_SERVER_ERROR;
    let statusCode = HTTP_RESPONSE_CODES.INTERNAL_SERVER_ERROR;
    /** If validation errors exist */
    if (error instanceof BadRequest) {
      statusCode = HTTP_RESPONSE_CODES.BAD_REQUEST;
      errorMessage = error.message
        .split(/,(?=ValidationError:)/)
        .map((e) => e.trim());
      console.log(
        "Validation error messages - Simulation Post API:",
        errorMessage
      );
    }
    return sendResponse(statusCode, { errorMessage });
  }
};
