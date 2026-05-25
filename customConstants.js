/* Put constant variable here */

const HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
};

const API_ERROR_MESSAGE = {
  ACCESS_DENIED: "Access denied",
  INTERNAL_SERVER_ERROR: "Internal Server Error",
};

const DB_CLOSE_CONNECTION_STMT = `DB connection closed successfully!`;

const CT_TIME_ZONE = "America/Chicago";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_MAP = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const SCENARIO_TYPES = {
  AP: "AP",
  GETSUDO: "Getsudo",
  CUSTOM: "Custom",
};

const SCENARIO_STATUSES = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const SCENARIO_TABLE_TABS = {
  ALL: "all",
  GETSUDO: "getsudo",
};

const MONTH_FILTER_VALID_VALUES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "all",
];

const STATUS_FILTER_VALID_VALUES = [
  "Not Started",
  "In Progress",
  "Completed",
  "all",
];

const NAMC_FILTER_VALID_VALUES = [
  "TMMGT",
  "TMMBC",
  "TMMI",
  "TMMK",
  "MTM",
  "TMMMS",
  "TMMTX",
  "TMMC",
  "all",
];

const SCENARIO_STEP_STATUSES = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ERROR: "Error",
};

const JOB_EXECUTION_STATUSES = {
  SUCCESS: "success",
  ERROR: "error",
};

const INIT_SCENARIO_STEP_STATUS_DATA = {
  "Line Level Inputs": {
    "NAMC Production Calendar": "Not Started",
    "Model Change Dates": "Not Started",
    "NAMC Allocation Plan": "Not Started",
  },
  "Vanning Center Inputs": {
    "Shipping Pattern": "Not Started",
    "Vanning Lead Time": "Not Started",
    "TMC Working Day Calendar": "Not Started",
  },
  "Grouping Settings": {
    Grouping: "Not Started",
    "Min Max DoH": "Not Started",
    "Fluctuation Allowance": "Not Started",
  },
  other: ["Simulation", "Review", "Reports"],
};

const VALID_STEP_TYPES = [
  "Line Level Inputs",
  "Vanning Center Inputs",
  "Grouping Settings",
];

const VALID_STEP_NAMES = [
  "NAMC Production Calendar",
  "Model Change Dates",
  "NAMC Allocation Plan",
  "Shipping Pattern",
  "Vanning Lead Time",
  "TMC Working Day Calendar",
  "Grouping",
  "Min Max DoH",
  "Fluctuation Allowance",
];

const VALID_VANNING_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DEFAULT_CARRIER = "-";

const MAX_SIMULATIONS_PER_REQUEST = 15;

const VALID_SIMULATION_RESULT_TYPES = [
  "daily-inventory",
  "daily-timeline",
  "monthly",
  "yearly",
];

const TMC_CALENDAR_NOTIFICATION_MESSAGE =
  "The following dates were changed from non-working to working: {dates}. Please review Shipping Pattern and Vanning Lead Time data.";

const PPR_STATUSES = {
  PPR1: "PPR1",
  PPR2: "PPR2",
  PPR3: "PPR3",
  PPR_GT3: "PPR_GT3",
};

const SIMULATION_STATUSES = {
  NOT_STARTED: "Not Started",
  APPROVED: "Approved",
  PROMOTED: "Promoted",
  SUBMITTED_FOR_REVIEW: "Submitted For Review",
  REJECTED: "Rejected",
  ERROR: "Error",
  COMPLETED: "Completed",
  INFEASIBLE: "Infeasible",
};

const JOB_TYPES = {
  SIMULATION: "simulation",
  FILE_UPLOAD: "file-upload",
};

const VALID_CONFIRMATION_STATUSES = ["Approved", "Promoted", "Rejected"];

const VALID_REPORT_TYPES = [
  "Monthly Summary",
  "Inventory Detail",
  "Timeline Detail",
  "Subseries Daily",
  "OSP Report",
];

const VALID_MODES = ["download", "email"];

const REPORT_TYPE_TABLE_MAP = {
  "Monthly Summary": "monthly_summary_report",
  "Inventory Detail": "inventory_daily_report",
  "Timeline Detail": "timeline_report",
  "Subseries Daily": "subseries_detail_report",
  "OSP Report": "osp_report",
};

const SCENARIO_NOT_EDITABLE =
  "Validation error: Updates cannot be made because at least one of the scenario simulations is not currently in draft status.";

module.exports = {
  HTTP_METHOD,
  API_ERROR_MESSAGE,
  DB_CLOSE_CONNECTION_STMT,
  CT_TIME_ZONE,
  MONTHS,
  SCENARIO_TYPES,
  MONTH_MAP,
  SCENARIO_TABLE_TABS,
  SCENARIO_STATUSES,
  MONTH_FILTER_VALID_VALUES,
  NAMC_FILTER_VALID_VALUES,
  STATUS_FILTER_VALID_VALUES,
  SCENARIO_STEP_STATUSES,
  JOB_EXECUTION_STATUSES,
  INIT_SCENARIO_STEP_STATUS_DATA,
  VALID_STEP_TYPES,
  VALID_STEP_NAMES,
  VALID_VANNING_DAYS,
  DAYS_OF_WEEK,
  DEFAULT_CARRIER,
  MAX_SIMULATIONS_PER_REQUEST,
  TMC_CALENDAR_NOTIFICATION_MESSAGE,
  VALID_SIMULATION_RESULT_TYPES,
  PPR_STATUSES,
  SIMULATION_STATUSES,
  JOB_TYPES,
  VALID_CONFIRMATION_STATUSES,
  VALID_REPORT_TYPES,
  VALID_MODES,
  REPORT_TYPE_TABLE_MAP,
  SCENARIO_NOT_EDITABLE,
};
