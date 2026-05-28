/**
 * @description this file contains delete scenario common utils.
 */

/**
 * @description Function to prepare response
 * @returns {Object} Success message
 */
function prepareResponse() {
  return {
    message: "Successfully deleted scenario.",
  };
}

module.exports = {
  prepareResponse,
};
