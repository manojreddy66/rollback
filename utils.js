/**
 * @description this file contains rollback simulation common utils
 */

/**
 * @description Function to prepare success response for rollback simulation API
 * @returns {Object} response - success response with message
 */
function prepareResponse() {
  return {
    message: "Successfully rolled back rundown to draft state.",
  };
}

module.exports = {
  prepareResponse,
};
