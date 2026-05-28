/**
 * @description this file contains post groups common utils
 */

/**
 * @description Function to prepare success response for post groups api
 * @returns {Object} response - success response
 */
function prepareResponse() {
  return {
    message: "Successfully updated data.",
  };
}

/**
 * @description Function to split payload rows into update rows and create rows
 * @param {Array} data - request body data array
 * @returns {Object} updateGroups and newGroups
 */
function segregateUpdateAndNewGroupInput(data) {
  const updateGroups = [];
  const newGroups = [];
  data.forEach((item) => {
    if (typeof item.groupScenarioMapId === "string") {
      updateGroups.push(item);
    } else {
      newGroups.push(item);
    }
  });

  return { updateGroups, newGroups };
}
/**
 * @description Function to prepare bulk upsert scenario link rows
 * @param {String} scenarioId - scenario id
 * @param {String} userEmail - user email
 * @param {Array} finalGroupsData - array of { groupId, groupName }
 * @returns {Array} formatted rows for bulk upsert
 */
function prepareScenarioLinksData(scenarioId, userEmail, finalGroupsData) {
  return finalGroupsData.map((item) => ({
    scenarioId,
    userEmail,
    groupId: item.groupId,
    groupName: item.groupName,
  }));
}

module.exports = {
  prepareResponse,
  segregateUpdateAndNewGroupInput,
  prepareScenarioLinksData,
};
