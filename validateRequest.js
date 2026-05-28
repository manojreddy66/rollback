/**
 * @description This file contains input validations for delete scenario API
 */

const { emptyInputCheck } = require("utils/common_utils");
const { dbConnect } = require("prismaORM/index");
const {
  getValidationSchema,
} = require("schemaValidator/supplyPlanning/scenario/deleteScenarioSchema");
const { scenariosData } = require("prismaORM/services/scenariosService");
const { SCENARIO_STATUSES } = require("constants/customConstants");

/**
 * @description Validate input and business rules for delete scenario.
 * @param {Object} body: API input request
 * @returns {Promise<Array>} errorMessages: List of validation error messages
 *  - Request body must not be empty
 *  - Scenario must exist and be active
 *  - Only creator can delete
 *  - Cannot delete if scenario is Completed
 */
async function validateInput(body) {
  const errorMessages = [];
  /**
   * @description Validate: request body should not be empty.
   */
  emptyInputCheck(body);
  /**
   * @description Function to validate input request
   */
  validateParams(body, errorMessages);
  //DB validations
  if (!errorMessages.length) {
    await validateScenarioDeletable(body, errorMessages);
  }
  return { errorMessages: [...new Set(errorMessages)] };
}

/**
 * @description Function to validate input request
 * @param {Object} body: API input request
 * @returns {Array} errorMessages: List of validation error messages
 */
function validateParams(body, errorMessages) {
  const schema = getValidationSchema();
  const { error } = schema.validate(body, { abortEarly: false });
  if (error?.details?.length) {
    error.details.forEach((e) => {
      errorMessages.push(e.message);
    });
  }
}

/**
 * @description Function to validate scenario deletable conditions in DB:
 * 1) Scenario exists AND is active
 * 2) Cannot delete if scenario_status is 'Completed'
 * 3) Only creator can delete
 * @returns {Promise<boolean>}
 */
async function validateScenarioDeletable(body, errorMessages) {
  const rdb = await dbConnect();
  const scenariosService = new scenariosData(rdb);
  try {
    const scenarioData = await scenariosService.getScenarioDataById(
      body.scenarioId
    );
    const scenarioDetails = scenarioData?.[0];
    /* Check if scenario exists in DB.*/
    if (!scenarioDetails) {
      errorMessages.push("ValidationError: Scenario doesn't exist.");
      return;
    }
    /* Check if scenario is not in completed/rundown-complete status.*/
    if (scenarioDetails.scenario_status === SCENARIO_STATUSES.COMPLETED) {
      errorMessages.push(
        "ValidationError: Scenario cannot be deleted once rundown is complete."
      );
    }
    /* Check if the creator is the same as the requester */
    if (scenarioDetails.user_email !== body.userEmail) {
      errorMessages.push(
        "ValidationError: Only user who has created the scenario is allowed to delete."
      );
    }
  } catch (err) {
    console.log("Error in validateScenarioDeletable:", err);
    throw err;
  }
}

module.exports = { validateInput };
