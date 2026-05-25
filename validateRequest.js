/**
 * @description this file contains input request validation methods
 */

const { dbConnect } = require("prismaORM/index");
const { scenariosData } = require("prismaORM/services/scenariosService");
const {
  groupScenarioMapperData,
} = require("prismaORM/services/groupScenarioMapperService");
const {
  scenarioStepStatusData,
} = require("prismaORM/services/scenarioStepStatusService");
const {
  getValidationSchema,
} = require("schemaValidator/supplyPlanning/simulation/postSimulationSchema");
const { emptyInputCheck } = require("utils/common_utils");
const { SCENARIO_STEP_STATUSES } = require("constants/customConstants");
const { BadRequest } = require("utils/api_response_utils");

/**
 * @description Function to validate input request body
 * @param {Object} reqPayload: API input request body
 * @returns {Promise<Object>} errorMessages - Validation errors if any
 */
async function validateRequestBody(reqPayload) {
  const errorMessages = [];
  /**
   * @description Function to check if request body is empty
   * @param {Object} reqPayload: Input request
   */
  emptyInputCheck(reqPayload);
  /**
   * @description Validate request body using Joi schema
   */
  validateParams(reqPayload, errorMessages);

  /**
   * @description If Joi validation passed, perform DB validations
   */
  if (errorMessages.length === 0) {
    /**
     * @description Validate scenario exists (DB validation)
     * @returns {Promise<void>} Void if scenario exists, otherwise throws BadRequest error
     */
    await checkForInvalidScenarioId(reqPayload);
    /**
     * @description Validate groupIds exist in group_scenario_mapper (DB validation)
     * @returns {Promise<void>} Void if all groupIds are valid, otherwise throws BadRequest error
     */
    await checkForInvalidScenarioGroupIds(reqPayload);
    /**
     * @description Validate all scenario input steps are completed (DB validation)
     * @returns {Promise<void>} Void if all steps are completed, otherwise throws BadRequest error
     */
    await checkForPendingSteps(reqPayload);
  }

  return { errorMessages: [...new Set(errorMessages)] };
}

/**
 * @description Function to validate request params using Joi schema
 * @param {Object} inputParams - request body
 * @param {Array} errorMessages - array to collect validation errors
 */
function validateParams(inputParams, errorMessages) {
  const schema = getValidationSchema();
  const { error } = schema.validate(inputParams, { abortEarly: false });
  if (error?.details?.length) {
    error.details.forEach((e) => errorMessages.push(e.message));
  }
}

/**
 * @description Function to check if a scenario exists by scenarioId
 * @param {Object} inputParams - request body containing scenarioId
 * @throws {BadRequest} if scenario doesn't exist
 * @returns {Promise<void>} Void if scenario exists, otherwise throws BadRequest error 
 */
async function checkForInvalidScenarioId(inputParams) {
  const rdb = await dbConnect();
  const scenariosService = new scenariosData(rdb);
  try {
    /**
     * @description Get scenario data by scenarioId
     */
    const scenarioData = await scenariosService.getScenarioDataById(
      inputParams.scenarioId
    );
    /**
     * @description If scenario doesn't exist, throw BadRequest
     */
    if (!scenarioData || scenarioData.length === 0) {
      throw new BadRequest("ValidationError: Scenario doesn't exist.");
    }
  } catch (err) {
    console.log("Error in checkForInvalidScenarioId:", err);
    throw err;
  }
}

/**
 * @description Function to check if groupIds exist in group_scenario_mapper for a scenario
 * @param {Object} inputParams - request body containing scenarioId and data[].groupId
 * @throws {BadRequest} if any groupId is invalid for the given scenario
 * @returns {Promise<void>} Void if all groupIds are valid, otherwise throws BadRequest error with details of invalid groupIds
 */
async function checkForInvalidScenarioGroupIds(inputParams) {
  const rdb = await dbConnect();
  const groupScenarioMapperService = new groupScenarioMapperData(rdb);
  try {
    /**
     * @description Extract unique groupIds from request data
     */
    const uniqueGroupIds = [
      ...new Set(inputParams.data.map((row) => row.groupId)),
    ];
    /**
     * @description Fetch valid group-scenario mappings from DB
     */
    const validGroups =
      await groupScenarioMapperService.getGroupScenarioMapperData(
        inputParams.scenarioId,
        uniqueGroupIds
      );
    /**
     * @description Identify groupIds not found in group_scenario_mapper
     */
    const validGroupIds = new Set(validGroups.map((g) => g.groupId));
    const invalidGroupIds = uniqueGroupIds.filter(
      (id) => !validGroupIds.has(id)
    );
    /**
     * @description If any invalid groupIds found, throw BadRequest with details
     */
    if (invalidGroupIds.length > 0) {
      throw new BadRequest(
        `ValidationError: Provided combination of scenarioId and groupIds - [${invalidGroupIds.join(", ")}] doesn't exist.`
      );
    }
  } catch (err) {
    console.log("Error in checkForInvalidScenarioGroupIds:", err);
    throw err;
  }
}

/**
 * @description Function to check if all scenario input steps are completed before simulation
 * @param {Object} inputParams - request body containing scenarioId
 * @throws {BadRequest} if any input step is not in COMPLETED status
 * @returns {Promise<void>} Void if all steps are completed, otherwise throws BadRequest error with details of pending steps
 */
async function checkForPendingSteps(inputParams) {
  const rdb = await dbConnect();
  const scenarioStepStatusService = new scenarioStepStatusData(rdb);
  try {
    /**
     * @description Fetch all scenario step statuses by scenarioId
     */
    const stepStatusData =
      await scenarioStepStatusService.getScenarioStepStatusData(
        inputParams.scenarioId
      );
    /**
     * @description Filter steps that are not in COMPLETED status
     */
    const pendingSteps = stepStatusData
      .filter((s) => s.status !== SCENARIO_STEP_STATUSES.COMPLETED)
      .map((s) => s.input_step_name);
    /**
     * @description If any pending steps found, throw BadRequest with step names
     */
    if (pendingSteps.length > 0) {
      throw new BadRequest(
        `ValidationError: Cannot generate rundown, [${pendingSteps.join(", ")}] pending ready status.`
      );
    }
  } catch (err) {
    console.log("Error in checkForPendingSteps:", err);
    throw err;
  }
}

module.exports = {
  validateRequestBody,
};
