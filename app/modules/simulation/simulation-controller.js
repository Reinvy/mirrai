"use strict";

const {
  simulateScenario,
  conductCouncilDebate,
  getUserSimulations,
  getSimulationById,
} = require("./simulation-service");
const { formatSuccessResponse } = require("../../utils/response-formatter");

async function branchSimulationController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { scenario, title } = req.body;
    const result = await simulateScenario({ userId, scenario, title });
    res.status(200).json(
      formatSuccessResponse({
        message: "Skenario simulasi berhasil dihasilkan",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function councilDebateController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const { dilemma, title } = req.body;
    const result = await conductCouncilDebate({ userId, dilemma, title });
    res.status(200).json(
      formatSuccessResponse({
        message: "Debat dewan persona internal berhasil dijalankan",
        data: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getUserSimulationsController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const data = await getUserSimulations(userId);
    res.status(200).json(
      formatSuccessResponse({
        message: "Daftar riwayat simulasi berhasil diambil",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getSimulationByIdController(req, res, next) {
  try {
    const userId = req.credentials.id;
    const data = await getSimulationById(userId, req.params.id);
    res.status(200).json(
      formatSuccessResponse({
        message: "Detail simulasi berhasil diambil",
        data,
      }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  branchSimulationController,
  councilDebateController,
  getUserSimulationsController,
  getSimulationByIdController,
};
