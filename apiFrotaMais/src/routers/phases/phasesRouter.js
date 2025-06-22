import express from "express";
import * as controller from "../../controllers/phasesController.js";
import { verify } from "../../controllers/authController.js";

const router = express.Router();

// Listar todas as fases de manutenção
router.get("/", verify, controller.listMaintenancePhases);

// Filtros específicos para fases ativas e em andamento
router.get("/active", verify, (req, res, next) => {
  req.query.ativo = "true";
  controller.listMaintenancePhases(req, res, next);
});

// Filtros por tipo de fase
router.get("/iniciar-viagem", verify, (req, res, next) => {
  req.query.tipoFase = "INICIAR_VIAGEM";
  req.query.ativo = "true";
  controller.listMaintenancePhases(req, res, next);
});

router.get("/deixar-veiculo", verify, (req, res, next) => {
  req.query.tipoFase = "DEIXAR_VEICULO";
  req.query.ativo = "true";
  controller.listMaintenancePhases(req, res, next);
});

router.get("/servico-finalizado", verify, (req, res, next) => {
  req.query.tipoFase = "SERVICO_FINALIZADO";
  req.query.ativo = "true";
  controller.listMaintenancePhases(req, res, next);
});

router.get("/retorno-veiculo", verify, (req, res, next) => {
  req.query.tipoFase = "RETORNO_VEICULO";
  req.query.ativo = "true";
  controller.listMaintenancePhases(req, res, next);
});

router.get("/veiculo-entregue", verify, (req, res, next) => {
  req.query.tipoFase = "VEICULO_ENTREGUE";
  controller.listMaintenancePhases(req, res, next);
});

// Filtros por status da manutenção (equivalentes aos anteriores)
router.get("/approved", verify, (req, res, next) => {
  req.query.status = "aprovado";
  controller.listMaintenancePhases(req, res, next);
});

router.get("/completed", verify, (req, res, next) => {
  req.query.status = "concluido";
  controller.listMaintenancePhases(req, res, next);
});

// Operações específicas de uma manutenção
router.get("/maintenance/:manutencaoId", verify, controller.getMaintenancePhases);

// Criar nova fase para uma manutenção
router.post("/maintenance/:manutencaoId/phase", verify, controller.createPhase
);

// Avançar para próxima fase automaticamente
router.post("/maintenance/:manutencaoId/advance", verify, controller.advanceToNextPhase
);

// Operações de fase específica
router.get("/:id", verify, controller.getPhaseById);

router.put("/:id", verify, controller.updatePhase);

export default router;