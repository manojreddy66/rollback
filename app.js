/**
 * @name update-groups
 * @description Returns success message after creating/updating groups for a scenario
 * @createdOn Apr 30th, 2026
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
const { upsertGroupData } = require("./groupsService");
const { API_ERROR_MESSAGE } = require("constants/customConstants");

/**
 * @description Lambda handler for POST Groups API.
 * @param {Object} event: API event with request body:
  {
    "scenarioId": "uniqueScenarioId",
    "userEmail": "user@toyota.com",
    "data": [
      {
        "groupId": "group-uuid-1",
        "groupScenarioMapId": "grp_scenario_mp_id uuid",
        "groupName": "Group1",
        "vanningCenter": "TMK",
        "subSeriesList": ["CAMRY", "RAV4 Gas"]
      },
      {
        "groupId": "1",
        "groupScenarioMapId": 1,
        "groupName": "Group2",
        "vanningCenter": "TMH",
        "subSeriesList": ["HighLander"]
      }
    ]
  }
 * @returns {Promise<Object>}: response sample is detailed below.
 * Success response with status code 200:
 * {
    "message": "Successfully updated data."
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
     * @description Function to validate input and create/update groups.
     * @param {Object} event: Input parameters
     * @returns {Object} updateResponse - success response
     */
    const updateResponse = await upsertGroupData(event);
    console.log("Update Groups Post API Response:", updateResponse);
    return sendResponse(HTTP_RESPONSE_CODES.SUCCESS, updateResponse);
  } catch (error) {
    console.log("Update Groups Post API - Handler Error:", error);
    let errorMessage = API_ERROR_MESSAGE.INTERNAL_SERVER_ERROR;
    let statusCode = HTTP_RESPONSE_CODES.INTERNAL_SERVER_ERROR;
    /**
     * @description If error is BadRequest, return 400 with validation messages
     */
    if (error instanceof BadRequest) {
      statusCode = HTTP_RESPONSE_CODES.BAD_REQUEST;
      errorMessage = error.message
        .split(/,(?=ValidationError:)/)
        .map((err) => err.trim());
      console.log(
        "Validation error messages - Update Groups Post API:",
        errorMessage
      );
    }
    return sendResponse(statusCode, { errorMessage });
  }
};
