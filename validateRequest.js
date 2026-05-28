/**
 * @description this file contains request validation methods
 */

const { dbConnect } = require("prismaORM/index");
const { scenariosData } = require("prismaORM/services/scenariosService");
const {
  groupScenarioMapperData,
} = require("prismaORM/services/groupScenarioMapperService");
const { groupingData } = require("prismaORM/services/groupingService");
const {
  getValidationSchema,
} = require("schemaValidator/supplyPlanning/grouping/postGroupsSchema");
const {
  emptyInputCheck,
  checkForNonEditableScenario,
  buildExistingSignatureToGroupIds,
  validateDuplicateSignatureInInput,
  validateDuplicateSignatureWithExisting,
} = require("utils/common_utils");
const { BadRequest } = require("utils/api_response_utils");

/**
 * @description Function to validate input request body
 * @param {Object} groupsInput: API input request body
 * @returns {Promise<Object>} errorMessages - Validation errors if any
 * & scenarioData - scenario data by scenarioId
 */
async function validateInput(groupsInput) {
  const errorMessages = [];
  /**
   * @description Function to check if request body is empty
   * @param {Object} groupsInput: Input request
   */
  emptyInputCheck(groupsInput);
  /**
   * @description Validate request body using Joi schema
   */
  validateParams(groupsInput, errorMessages);

  let scenarioData = null;
  /**
   * @description If Joi validation passed, perform DB validations
   */
  if (errorMessages.length === 0) {
    /**
     * @description Validate scenario exists (DB validation)
     */
    scenarioData = await checkForInvalidScenario(groupsInput);
    /**
     * @description If scenario exists, validate that all simulations are in draft status
     */
    await checkForNonEditableScenario(groupsInput);
    /**
     * @description Check if groupName already exists for the scenario
     */
    await checkForDuplicateGroupName(groupsInput);
    /**
     * @description Check if vanningCenter and subSeriesList combination already exists for the scenario
     */
    await checkForDuplicateVanningCenterSubSeries(groupsInput);
  }
  return { errorMessages: [...new Set(errorMessages)], scenarioData };
}

/**
 * @description Function to validate request body using Joi schema
 * @param {Object} groupsInput - request body
 * @param {Array} errorMessages - array to collect validation errors
 */
function validateParams(groupsInput, errorMessages) {
  const schema = getValidationSchema();
  const { error } = schema.validate(groupsInput, { abortEarly: false });
  if (error?.details?.length) {
    error.details.forEach((e) => errorMessages.push(e.message));
  }
}

/**
 * @description Function to check if a scenario exists
 * @param {Object} groupsInput - request body
 * @returns {Promise<Object|null>} scenario row if exists else throw error
 */
async function checkForInvalidScenario(groupsInput) {
  const rdb = await dbConnect();
  const scenariosService = new scenariosData(rdb);
  try {
    /**
     * @description Get scenario data by scenarioId
     */
    const scenarioData = await scenariosService.getScenarioDataById(
      groupsInput.scenarioId
    );
    /**
     * @description If scenario doesn't exist, add validation error and return null
     */
    if (!scenarioData || scenarioData.length === 0) {
      throw new BadRequest("ValidationError: Scenario doesn't exist.");
    }
    return scenarioData[0];
  } catch (err) {
    console.log("Error in checkForInvalidScenario:", err);
    throw err;
  }
}

/**
 * @description Function to check if provided groupName already exists for the scenario
 * @param {Object} groupsInput - request body
 * @returns {Promise<void>} Void if validation is successful
 */
async function checkForDuplicateGroupName(groupsInput) {
  const { scenarioId, data } = groupsInput;
  const rdb = await dbConnect();
  const groupScenarioMapperService = new groupScenarioMapperData(rdb);
  try {
    /**
     * @description Extract groupNames and groupScenarioMapIds of update rows to exclude
     */
    const groupNames = data.map((item) => item.groupName);
    const excludeGroupScenarioMapIds = data
      .filter((item) => typeof item.groupScenarioMapId === "string")
      .map((item) => item.groupScenarioMapId);
    /**
     * @description Get existing group names for the scenario excluding update rows
     */
    const existingGroups =
      await groupScenarioMapperService.getExistingGroupNames(
        scenarioId,
        groupNames,
        excludeGroupScenarioMapIds
      );
    /**
     * @description If any groupName already exists, throw validation error
     */
    if (existingGroups && existingGroups.length > 0) {
      throw new BadRequest(
        "ValidationError: Provided groupName already exists."
      );
    }
  } catch (err) {
    console.log("Error in checkForDuplicateGroupName:", err);
    throw err;
  }
}

/**
 * @description Function to check if vanningCenter and subSeriesList combination already exists for the scenario
 * @param {Object} groupsInput - request body
 * @returns {Promise<void>} Void if validation is successful
 */
async function checkForDuplicateVanningCenterSubSeries(groupsInput) {
  const { scenarioId, data } = groupsInput;
  const rdb = await dbConnect();
  const groupingDataService = new groupingData(rdb);
  try {
    /**
     * @description Extract groupScenarioMapIds of update rows to exclude
     */
    const excludeGroupScenarioMapIds = data
      .filter((item) => typeof item.groupScenarioMapId === "string")
      .map((item) => item.groupScenarioMapId);
    /**
     * @description Get existing vanningCenter and subSeriesList combinations for the scenario excluding update rows
     */
    const existingGroupData =
      await groupingDataService.getGroupsDataByScenarioId(scenarioId);
    /**
     * @description Build a unique signature for each groupId using vanningCenter + sorted subSeries list
     */
    validateDuplicateSignatureInInput(data);
    /* If active groups exists for scenario */
    if (existingGroupData && existingGroupData.length > 0) {
      const existingSignatureToGroupIds = buildExistingSignatureToGroupIds(
        existingGroupData,
        excludeGroupScenarioMapIds
      );
      /**
       * @description Validate that no signature in input matches with existing signatures for different groupScenarioMapIds, if yes throw validation error
       */
      validateDuplicateSignatureWithExisting(data, existingSignatureToGroupIds);
    }
  } catch (err) {
    console.log("Error in checkForDuplicateVanningCenterSubSeries:", err);
    throw err;
  }
}

module.exports = {
  validateInput,
};
