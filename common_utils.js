/** Common Utilities */
const { dbConnect } = require("prismaORM/index");
const { BadRequest } = require("utils/api_response_utils");
const {
  MONTH_MAP,
  SCENARIO_TYPES,
  SCENARIO_TABLE_TABS,
  INIT_SCENARIO_STEP_STATUS_DATA,
  MONTHS,
  SCENARIO_STEP_STATUSES,
  CT_TIME_ZONE,
  SCENARIO_NOT_EDITABLE,
  SIMULATION_STATUSES,
} = require("constants/customConstants");
const moment = require("moment-timezone");
const { Prisma } = require("@prisma/client");
const {
  tmcWorkingDayCalendarData,
} = require("prismaORM/services/tmcWorkingDayCalendarService");
const {
  namcProductionCalendarData,
} = require("prismaORM/services/namcProductionCalendarService");
const { simulationData } = require("prismaORM/services/simulationService");

/* Check if body is not empty */
function emptyInputCheck(body) {
  /* Validate the requestId from input - if no errors, returns the transformed request body */
  if (!body || Object.keys(body).length === 0) {
    throw new BadRequest("ValidationError: Request body cannot be empty.");
  }
}

/**
 * @description Function to format cycle to YYYYMM
 * @param {*} cycle: Scenario cycle (Jan26)
 * @returns {*} formattedCycle - YYYYMM (202501)
 */
function formatScenarioCycle(cycle) {
  const month = cycle.slice(0, 3); // "Jan"
  const year = cycle.slice(3); // "26"

  const formattedMonth = MONTH_MAP[month];
  const formattedYear = `20${year}`; // "2026"

  return `${formattedYear}${formattedMonth}`;
}

/**
 * @description Function to format date to given format
 * @param {*} inputDate: input date value
 * @param {*} dateFormat: Expected date format
 * @returns {*} formatted date
 */
function formatDate(inputDate, dateFormat) {
  return moment(inputDate).format(dateFormat);
}

/**
 * @description Function to get query condition based on tab
 * @param {*} tab: Scenario table tab
 * @returns {*} query condition
 */
function getConditionByTab(tab) {
  if (tab === SCENARIO_TABLE_TABS.ALL) {
    return Prisma.empty;
  }
  return Prisma.sql` AND plan_type = ${SCENARIO_TYPES.GETSUDO}`;
}

/**
 * Build month filter condition using SIMILAR TO
 * Example: ["Jan","Feb"] -> AND scenario_cycle similar to '(Jan|Feb)%'
 */
function buildScenarioCycleMonthCondition(months) {
  const pattern = `(${months.join("|")})%`;
  return Prisma.sql` AND scenario_cycle SIMILAR TO ${pattern}`;
}

/**
 * Build filter conditions (common for All + Getsudo tabs)
 * @param {Object} params Input request params
 * @param {*} queryConditionForDataNCountByTab base condition (Prisma.empty or Prisma.sql`...`)
 * @returns {*} Prisma SQL fragment safe for $queryRaw
 */
function getFilterConditions(params, queryConditionForDataNCountByTab) {
  const conditions = [queryConditionForDataNCountByTab || Prisma.empty];

  if (params.month && !params.month.includes("all")) {
    conditions.push(buildScenarioCycleMonthCondition(params.month));
  }

  if (params.namc && !params.namc.includes("all")) {
    conditions.push(Prisma.sql` AND namc IN (${Prisma.join(params.namc)})`);
  }

  if (params.status && !params.status.includes("all")) {
    conditions.push(
      Prisma.sql` AND scenario_status IN (${Prisma.join(params.status)})`
    );
  }

  if (params.createdBy && !params.createdBy.includes("all")) {
    conditions.push(
      Prisma.sql` AND user_email IN (${Prisma.join(params.createdBy)})`
    );
  }

  return Prisma.join(conditions, "");
}

/**
 * @description Function to get step name from substep name by looking into INIT_SCENARIO_STEP_STATUS_DATA
 * @param {string} substepName - e.g. "NAMC Production Calendar" or "Grouping"
 * @returns {string|null} stepName - e.g. "Line Level Inputs" or "Grouping Settings"
 */
function getStepNameFromSubstep(substepName) {
  for (const [stepName, stepValue] of Object.entries(
    INIT_SCENARIO_STEP_STATUS_DATA
  )) {
    if (
      stepValue &&
      typeof stepValue === "object" &&
      !Array.isArray(stepValue)
    ) {
      if (Object.hasOwn(stepValue, substepName)) {
        return stepName;
      }
    }
  }
  return null; // not found
}

/**
 * @description Helper to extract model year number from modelYear string - "MY 25" / "MY25" -> 25
 * @param {String} modelYear - model year in format "MY YY"
 * @returns {Number} model year number (YY) as integer
 */
function getModelYearNumber(modelYear) {
  const match = new RegExp(/(\d{2})$/).exec(String(modelYear));
  // Joi already validates format, so match will exist.
  return Number.parseInt(match[1], 10);
}

/**
 * @description Helper to add days to a date object.
 * Used for validating continuity rule (next start = prev end + 1 day).
 * @param {Date} dateObj - base date
 * @param {Number} days - number of days to add
 * @returns {Date} new date with days added
 */
function addDays(dateObj, days) {
  const dt = new Date(dateObj);
  dt.setDate(dt.getDate() + days);
  return dt;
}

/**
 * @description Helper to convert a "YYYY-MM-DD" date string to "YYYYMM" format.
 * Used for month-level scenario timeframe comparisons.
 * Example: "2026-03-15" -> "202603"
 * @param {String|Date} dateStr - date value in "YYYY-MM-DD" or Date object
 * @returns {String} YYYYMM
 */
function dateStringToYearMonth(dateStr) {
  if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
    return dateStr.toISOString().slice(0, 7).replace("-", "");
  }

  const value = String(dateStr || "").trim();
  const ymdMatch = new RegExp(/^(\d{4})-(\d{2})-\d{2}$/).exec(value);
  if (ymdMatch) {
    return `${ymdMatch[1]}${ymdMatch[2]}`;
  }

  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 7).replace("-", "");
  }

  return "";
}

/**
 * @description Function to format monthYear from YYYY-MM to Mon-YY
 * @param {String} monthYear - monthYear value from DB
 * @returns {String} formatted monthYear
 */
function formatMonthYear(monthYear) {
  const [year, month] = monthYear.split("-");
  const monthIndex = Number(month) - 1;

  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthYear;
  }

  return `${MONTHS[monthIndex]}-${year.slice(-2)}`;
}

/**
 * @description Redistribute one monthly volume across daily rows based on work day percentages.
 * Uses floor allocation with remainder distribution by highest fractional remainder.
 * @param {Number} monthlyVolume - total monthly volume for the allocation group
 * @param {Array} allocationRows - daily rows in the allocation group
 * @param {Map} calendarPercentageMap - Map(prodDate -> workDayPercentage)
 * @returns {Array} updated daily rows with recalculated dailyVolume
 */
function redistributeMonthlyVolume(
  monthlyVolume,
  allocationRows,
  calendarPercentageMap
) {
  /**
   * @description Function to assign each daily record its work day percentage from the calendar data
   * @param {Array} allocationRows - Daily rows in the allocation group
   * @param {Map} calendarPercentageMap - Map(prodDate -> workDayPercentage)
   * @returns {Array} rows with assigned work day percentages
   */
  const provisionalRows = getDailyPercentages(
    allocationRows,
    calendarPercentageMap
  );

  // If total percentage is zero, all daily volumes are zero
  const totalPercentage = provisionalRows.reduce(
    (sum, row) => sum + row.percentage,
    0
  );

  if (totalPercentage === 0) {
    return provisionalRows.map(({ percentage, ...row }) => ({
      ...row,
      dailyVolume: 0,
    }));
  }

  // Floor-allocate daily volumes proportionally
  const rankedRows = provisionalRows.map((row) => {
    const rawDailyVolume = (monthlyVolume * row.percentage) / totalPercentage;
    const baseDailyVolume = Math.floor(rawDailyVolume);

    return {
      ...row,
      dailyVolume: baseDailyVolume,
      fraction: rawDailyVolume - baseDailyVolume,
    };
  });

  // Distribute remainder units to rows with highest fractional parts
  let remainder =
    monthlyVolume - rankedRows.reduce((sum, row) => sum + row.dailyVolume, 0);

  const rowsOrderedByFraction = rankedRows
    .filter((row) => row.percentage > 0)
    .sort(
      (left, right) =>
        right.fraction - left.fraction ||
        left.productionDate.localeCompare(right.productionDate)
    );

  let index = 0;
  while (remainder > 0 && rowsOrderedByFraction.length > 0) {
    rowsOrderedByFraction[index % rowsOrderedByFraction.length].dailyVolume +=
      1;
    remainder -= 1;
    index += 1;
  }

  // Strip temporary calculation fields before returning
  return rankedRows.map(({ fraction, percentage, ...row }) => row);
}

/**
 * @description Function to assign each daily record its work day percentage from the calendar data
 * @param {Array} allocationRows - Daily rows in the allocation group
 * @param {Map} calendarPercentageMap - Map(prodDate -> workDayPercentage)
 * @returns {Array} rows with assigned work day percentages
 */
function getDailyPercentages(allocationRows, calendarPercentageMap) {
  return allocationRows.map((row) => {
    const percentage = Number(
      calendarPercentageMap.get(row.productionDate) || 0
    );
    return {
      ...row,
      percentage: Math.max(percentage, 0),
    };
  });
}

/**
 * @description Function to get working day candidates for remainder distribution,
 * sorted by highest fractional remainder and then by production date
 * @param {Array} rows - daily data with weight and remainder properties
 * @returns {Array} sorted working day candidates for remainder distribution
 */
function getWorkingDayCandidates(rows) {
  return rows
    .filter((row) => row.weight > 0)
    .sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      return a.idx - b.idx;
    });
}

/**
 * @description Function to upsert scenario step status to In Progress
 * and update scenario status if not already In Progress
 * @param {Object} body - request payload containing scenarioId and userEmail
 * @param {Object} scenarioData - scenario row for the given scenarioId
 * @param {*} stepName - Step name
 * @param {Object} scenarioStepStatusService - scenarioStepStatusData service instance for DB operations on scenario_step_status table
 * @param {Object} scenariosDataService - scenariosData service instance for DB operations on scenarios table
 * @param {Object} tx - transaction object for DB operations
 */
async function updateScenarioNStepStatus(
  body,
  scenarioData,
  stepName,
  scenarioStepStatusService,
  scenariosDataService,
  tx
) {
  /**
   * @description Function to upsert scenario step status to In Progress
   * for the given step
   */
  await Promise.all([
    scenarioStepStatusService.upsertScenarioStepStatus(
      body.scenarioId,
      body.userEmail,
      stepName,
      getStepNameFromSubstep(stepName),
      SCENARIO_STEP_STATUSES.IN_PROGRESS,
      tx
    ),
    updateScenarioStatusToInProgress(
      scenarioData,
      body,
      scenariosDataService,
      tx
    ),
  ]);
}

/**
 * @description Function to upsert scenario step status to In Progress
 * for the given step
 * and update scenario status to In Progress if not already
 * @param {Object} scenarioData: scenario data for the given scenarioId
 * @param {Object} body: request payload containing scenarioId and userEmail
 * @param {Object} scenariosDataService: scenariosDataService instance for DB operations on scenarios table
 * @param {Object} tx: transaction object for DB operations
 */
async function updateScenarioStatusToInProgress(
  scenarioData,
  body,
  scenariosDataService,
  tx
) {
  /**
   * @description Update scenario status to "In Progress" if not already,
   * as user has made changes to scenario data
   */
  if (scenarioData.scenario_status !== SCENARIO_STEP_STATUSES.IN_PROGRESS) {
    await scenariosDataService.updateScenarioStatus(
      body.scenarioId,
      body.userEmail,
      SCENARIO_STEP_STATUSES.IN_PROGRESS,
      tx
    );
  }
}

/**
 * @description Check if an array is empty or nullish
 */
function isEmptyArray(arr) {
  return !arr || arr.length === 0;
}

/**
 * @description Function to get current timestamp in "MM/DD/YYYY, HH:MM AM/PM" format for CT timezone
 * @returns Current timestamp string
 * Example: "09/30/2024, 02:45 PM"
 */
function getCurrentTimestamp() {
  return new Date().toLocaleString("en-US", {
    timeZone: CT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * @description Function to validate whether provided vanning dates fall within scenario timeframe
 * @param {Object} requestBody - request body
 * @param {Object} scenarioData - scenario data from DB
 */
function validateScenarioTimeframe(requestBody, scenarioData) {
  const scenarioStartMonth = scenarioData.start_month_year;
  const scenarioEndMonth = scenarioData.end_month_year;
  const invalidDates = requestBody.data
    .filter((item) => {
      const vanningDateMonth = dateStringToYearMonth(item.vanningDate);
      return (
        vanningDateMonth < scenarioStartMonth ||
        vanningDateMonth > scenarioEndMonth
      );
    })
    .map((item) => item.vanningDate);
  if (invalidDates.length > 0) {
    throw new BadRequest(
      `ValidationError: vanningDate [${invalidDates.join(", ")}] must be within the scenario timeframe.`
    );
  }
}

/**
 * @description Function to validate whether provided vanning dates are working days
 * @param {Object} requestBody - request body
 * @returns {Promise<void>} Void if validation is successful, otherwise throws BadRequest error with list of non-working vanning dates provided in the request
 */
async function validateWorkingDays(requestBody) {
  const rdb = await dbConnect();
  const tmcWorkingDayCalendarDataService = new tmcWorkingDayCalendarData(rdb);
  try {
    const { scenarioId, vanningCenter, data } = requestBody;
    const vanningDates = data.map((item) => item.vanningDate);
    /**
     * @description Fetch TMC Working Days data for the scenario, vanning center & vanning dates.
     */
    const workingDays =
      await tmcWorkingDayCalendarDataService.getTmcWorkingDaysByDates(
        scenarioId,
        vanningCenter,
        vanningDates
      );

    const dateFormat = "YYYY-MM-DD";
    const workingDaySet = new Set(
      workingDays.map((item) => formatDate(item.prodDate, dateFormat))
    );
    /**
     * @description Identify vanning dates which are non-working days
     * by comparing with the fetched TMC working days
     * and create a list of non-working vanning dates provided in the request.
     */
    const invalidDates = [
      ...new Set(
        vanningDates.filter(
          (date) => !workingDaySet.has(formatDate(date, dateFormat))
        )
      ),
    ];
    /**
     * Check if any of the provided vanning dates are non-working days.
     * If yes, add validation error with the list of non-working vanning dates provided in the request.
     */
    if (invalidDates.length > 0) {
      throw new BadRequest(
        `ValidationError: Provided vanningDates [${invalidDates.join(", ")}] are non-working days.`
      );
    }
  } catch (err) {
    console.log("Error in validateWorkingDays:", err);
    throw err;
  }
}

/**
 * @description Get scenario start date from start_month_year (YYYYMM format)
 * @param {Object} scenarioData - scenario data with start_month_year
 * @returns {Date} first day of start month
 */
function getScenarioStartDate(scenarioData) {
  const yyyymm = String(scenarioData.start_month_year);
  const year = Number.parseInt(yyyymm.substring(0, 4), 10);
  const month = Number.parseInt(yyyymm.substring(4, 6), 10) - 1;
  return new Date(Date.UTC(year, month, 1));
}

/**
 * @description Get scenario end date from end_month_year (YYYYMM format)
 * @param {Object} scenarioData - scenario data with end_month_year
 * @returns {Date} last day of end month
 */
function getScenarioEndDate(scenarioData) {
  const yyyymm = String(scenarioData.end_month_year);
  const year = Number.parseInt(yyyymm.substring(0, 4), 10);
  const month = Number.parseInt(yyyymm.substring(4, 6), 10);
  return new Date(Date.UTC(year, month, 0));
}

/**
 * @description Function to check if all scenario simulations are in non-draft status
 * @param {Object} payload - request body
 * @returns {Promise<void>} Void if atleast one simulation is in draft status
 */
async function checkForNonEditableScenario(payload) {
  const rdb = await dbConnect();
  const simulationDataService = new simulationData(rdb);
  try {
    /**
     * @description Get all active simulations for the given scenarioId
     */
    const simulations = await simulationDataService.getSimulationsByScenarioId(
      payload.scenarioId
    );
    /**
     * @description Allow the request only if at least one simulation is still
     * in "Not Started"/"Error"/"Completed"/"Infeasible" state.
     * If simulations exist and none is "Not Started"/"Error"/"Completed"/"Infeasible",
     * it means all simulations are in some stage of progress and scenario is not editable,
     * hence push a validation error.
     */
    const hasDraftSimulation = simulations.some(
      (item) =>
        item.simulation_status.toLowerCase() ===
          SIMULATION_STATUSES.NOT_STARTED.toLowerCase() ||
        item.simulation_status.toLowerCase() ===
          SIMULATION_STATUSES.ERROR.toLowerCase() ||
        item.simulation_status.toLowerCase() ===
          SIMULATION_STATUSES.COMPLETED.toLowerCase() ||
        item.simulation_status.toLowerCase() ===
          SIMULATION_STATUSES.INFEASIBLE.toLowerCase()
    );
    if (simulations.length > 0 && !hasDraftSimulation) {
      throw new BadRequest(SCENARIO_NOT_EDITABLE);
    }
  } catch (err) {
    console.log("Error in checkForNonEditableScenario:", err);
    throw err;
  }
}

/**
 * @description Generate default month ranges (min: 0, max: 0) for the scenario timeframe
 * @param {String|Number} startMonthYear - scenario start in YYYYMM format
 * @param {String|Number} endMonthYear - scenario end in YYYYMM format
 * @returns {Array} array of range objects with year, month, monthName, min: 0, max: 0
 */
function generateDefaultRanges(startMonthYear, endMonthYear) {
  if (!startMonthYear || !endMonthYear) {
    return [];
  }
  const start = String(startMonthYear);
  const end = String(endMonthYear);
  let year = Number.parseInt(start.substring(0, 4), 10);
  let month = Number.parseInt(start.substring(4, 6), 10);
  const endYear = Number.parseInt(end.substring(0, 4), 10);
  const endMonth = Number.parseInt(end.substring(4, 6), 10);
  const ranges = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    ranges.push({
      year,
      month,
      monthName: getMonthName(month),
      min: 0,
      max: 0,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ranges;
}

/**
 * @description Function to get short month name from month number
 * @param {Number} month - month number
 * @returns {String} month short name
 */
function getMonthName(month) {
  return MONTHS[month - 1];
}

/**
 * @description Generate default month ranges with fa as 0 for the scenario timeframe
 * @param {String|Number} startMonthYear - scenario start in YYYYMM format
 * @param {String|Number} endMonthYear - scenario end in YYYYMM format
 * @returns {Array} array of range objects with month and fa
 */
function generateDefaultMonthlyFaRanges(startMonthYear, endMonthYear) {
  if (!startMonthYear || !endMonthYear) {
    return [];
  }

  const start = String(startMonthYear);
  const end = String(endMonthYear);

  let year = Number.parseInt(start.substring(0, 4), 10);
  let month = Number.parseInt(start.substring(4, 6), 10);
  const endYear = Number.parseInt(end.substring(0, 4), 10);
  const endMonth = Number.parseInt(end.substring(4, 6), 10);

  const ranges = [];

  while (year < endYear || (year === endYear && month <= endMonth)) {
    ranges.push({
      year,
      month,
      fa: 0,
    });

    month += 1;
    if (month > 12) {
      month -= 12;
      year += 1;
    }
  }

  return ranges;
}

/**
 * @description Function to extract year and month from monthly FA row
 * @param {Object} row - monthly FA row
 * @returns {Object} year and month values
 */
function getYearMonthFromRow(row) {
  const month = Number.parseInt(row?.month, 10);
  if (Number.isInteger(row?.year)) {
    return {
      year: row.year,
      month,
    };
  }

  const monthYear = row?.monthYear || row?.month_year;
  if (monthYear) {
    const value = String(monthYear);
    const year = Number.parseInt(value.substring(0, 4), 10);
    return {
      year: Number.isNaN(year) ? undefined : year,
      month,
    };
  }

  return {
    year: undefined,
    month,
  };
}

/**
 * @description Function to check if FA values are uniform across all months
 * @param {Array} ranges - monthly FA ranges
 * @returns {Boolean} true if uniform across all months else false
 */
function checkUniformity(ranges) {
  if (!ranges || ranges.length <= 1) {
    return true;
  }

  const firstRange = ranges[0];

  return ranges.every((range) => range.fa === firstRange.fa);
}

/**
 * @description Function to create group map from active groups data
 * @param {Array} groupsData - active groups data for given scenarioId
 * @returns {Object} groupMap - grouped map
 */
function createGroupMap(groupsData) {
  const groupMap = {};

  (groupsData || []).forEach((row) => {
    const groupKey = `${row.groupId}__${row.groupName}__${row.vanningCenter}`;

    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        groupId: row.groupId,
        groupName: row.groupName,
        vanningCenter: row.vanningCenter,
        fluctuationAllowance: {
          isUniformAcrossMonths: true,
          ranges: [],
        },
      };
    }
  });

  return groupMap;
}

/**
 * @description Function to validate whether provided order dates are non-working days
 * in the NAMC Production Calendar. If an orderDate exists in the calendar and is a
 * non-working day, throw a BadRequest error. If the orderDate doesn't exist in the
 * calendar, skip validation for that date.
 * @param {Object} requestBody - request body containing scenarioId and data array
 * @returns {Promise<void>} Void if validation is successful, otherwise throws BadRequest error
 */
async function validateOrderDatesWorkingDays(requestBody) {
  const rdb = await dbConnect();
  const namcProductionCalendarDataService = new namcProductionCalendarData(rdb);
  try {
    const { scenarioId, data } = requestBody;
    const orderDates = [...new Set(data.map((item) => item.orderDate))];
    /**
     * @description Fetch NAMC Production Calendar data for the scenario and provided order dates.
     */
    const calendarRows =
      await namcProductionCalendarDataService.getNamcProdCalendarByOrderDates(
        scenarioId,
        orderDates
      );
    const dateFormat = "YYYY-MM-DD";
    /**
     * @description Identify order dates which exist in the calendar and are non-working days.
     */
    const nonWorkingDates = calendarRows
      .filter((item) => !item.isWorkingDay)
      .map((item) => formatDate(item.prodDate, dateFormat));
    /**
     * @description If any provided order dates are non-working days, throw validation error.
     */
    if (nonWorkingDates.length > 0) {
      throw new BadRequest(
        `ValidationError: Provided orderDates [${nonWorkingDates.join(", ")}] are non-working days.`
      );
    }
  } catch (err) {
    console.log("Error in validateOrderDatesWorkingDays:", err);
    throw err;
  }
}

module.exports = {
  emptyInputCheck,
  formatScenarioCycle,
  formatDate,
  getConditionByTab,
  getFilterConditions,
  getStepNameFromSubstep,
  getModelYearNumber,
  addDays,
  dateStringToYearMonth,
  formatMonthYear,
  redistributeMonthlyVolume,
  getWorkingDayCandidates,
  updateScenarioNStepStatus,
  isEmptyArray,
  getCurrentTimestamp,
  validateScenarioTimeframe,
  validateWorkingDays,
  validateOrderDatesWorkingDays,
  getScenarioStartDate,
  getScenarioEndDate,
  checkForNonEditableScenario,
  generateDefaultRanges,
  getMonthName,
  generateDefaultMonthlyFaRanges,
  getYearMonthFromRow,
  checkUniformity,
  createGroupMap,
};
