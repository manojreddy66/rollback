/**
 * @description DB operation to delete scenario (set is_active=false)
 */

const { dbConnect } = require("prismaORM/index");
const { scenariosData } = require("prismaORM/services/scenariosService");

/**
 * @description Function to delete scenario
 * @param {Object} body: Input request payload
 * @returns {Promise<Object>} Response object
 */
async function deleteScenarioData(body) {
  const rdb = await dbConnect();
  const scenariosService = new scenariosData(rdb);
  try {
    /**
     * @description Function to delete scenario
     * @param {Object} body: Input request payload
     */
    await scenariosService.deleteScenario(body);
  } catch (err) {
    console.log("Error in deleteScenarioData:", err);
    throw err;
  }
}

module.exports = { deleteScenarioData };
