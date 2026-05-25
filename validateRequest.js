/**
 * @description this file contains input request validation methods
 */

const { dbConnect } = require("prismaORM/index");
const { simulationData } = require("prismaORM/services/simulationService");
const {
  getValidationSchema,
} = require("schemaValidator/supplyPlanning/simulation/postRollbackSimulationSchema");
const { emptyInputCheck } = require("utils/common_utils");
const { SIMULATION_STATUSES } = require("constants/customConstants");
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
  let simulationDetails = null;
  /**
   * @description If Joi validation passed, perform DB validations
   */
  if (errorMessages.length === 0) {
    /**
     * @description Validate simulation exists and is eligible for rollback
     * @returns {Promise<Object>} Object if simulation is valid for rollback, otherwise throws BadRequest error
     */
    simulationDetails = await validateRollbackEligibility(reqPayload);
  }

  return { errorMessages: [...new Set(errorMessages)], simulationDetails };
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
 * @description Function to validate simulation existence and rollback eligibility
 * @param {Object} inputParams - request body containing simulationId
 * @returns {Promise<Object>} Object if simulation is valid for rollback
 */
async function validateRollbackEligibility(inputParams) {
  const rdb = await dbConnect();
  const simulationDataService = new simulationData(rdb);
  try {
    /**
     * @description Get simulation data by simulationId
     */
    const simulationDetails = await simulationDataService.getSimulationById(
      inputParams.simulationId
    );
    /**
     * @description If simulation doesn't exist, throw BadRequest
     */
    if (!simulationDetails || simulationDetails.length === 0) {
      throw new BadRequest("ValidationError: simulationId doesn't exist.");
    }
    const simulationStatus = simulationDetails[0].simulation_status;
    /**
     * @description Approved or Promoted rundown cannot be reverted
     */
    if (
      simulationStatus === SIMULATION_STATUSES.APPROVED ||
      simulationStatus === SIMULATION_STATUSES.PROMOTED
    ) {
      throw new BadRequest(
        "ValidationError: Rundown cannot be reverted to the draft state, once approved or promoted."
      );
    }
    return simulationDetails[0];
  } catch (err) {
    console.log("Error in validateRollbackEligibility:", err);
    throw err;
  }
}

module.exports = {
  validateRequestBody,
};
