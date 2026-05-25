/**
 * @description this file contains post simulation common utils
 */

/**
 * @description Function to prepare success response for post simulation API
 * @returns {Object} response - success response with message
 */
function prepareResponse() {
  return {
    message: "Successfully initiated simulation.",
  };
}

module.exports = {
  prepareResponse,
};
