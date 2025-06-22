import prisma from "../config/database.js";
import { hashPassword } from "../utils/bcrypt.js";
import bcrypt from "bcrypt";

export const listMaintenancePhases = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Listar fases de manutenções"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['status'] = {
      in: 'query',
      description: 'Filtrar por status da manutenção (aprovado/concluido)',
      required: false,
      type: 'string'
    }
    #swagger.parameters['tipoFase'] = {
      in: 'query',
      description: 'Filtrar por tipo de fase',
      required: false,
      type: 'string'
    }
    #swagger.parameters['ativo'] = {
      in: 'query',
      description: 'Filtrar por fases ativas (true/false)',
      required: false,
      type: 'boolean'
    }
    #swagger.parameters['_page'] = {
      in: 'query',
      description: 'Número da página',
      required: false,
      type: 'integer'
    }
    #swagger.parameters['_limit'] = {
      in: 'query',
      description: 'Limite de itens por página',
      required: false,
      type: 'integer'
    }
  */
  try {
    const { _page, _limit, _sort, _order, status, tipoFase, ativo } = req.query;

    let whereClause = {};

    // Filtro por status da manutenção
    if (status) {
      whereClause.manutencao = {
        status: status
      };
    }

    // Filtro por tipo de fase
    if (tipoFase) {
      whereClause.tipoFase = tipoFase;
    }

    // Filtro por fases ativas
    if (ativo !== undefined) {
      whereClause.ativo = ativo === 'true';
    }

    // Filtro por supervisor (se for supervisor, só pode ver suas manutenções)
    if (req.payload && req.payload.funcao === 'supervisor') {
      whereClause.manutencao = {
        ...whereClause.manutencao,
        supervisorId: req.payload.id,
      };
    }

    const page = parseInt(_page) || 1;
    const limit = parseInt(_limit) || 10;
    const offset = (page - 1) * limit;

    const totalItems = await prisma.faseManutencao.count({ where: whereClause });
    const totalPages = Math.ceil(totalItems / limit);

    const order = _order?.toLowerCase() === "desc" ? "desc" : "asc";
    const validSortFields = ["id", "manutencaoId", "tipoFase", "dataInicio", "dataFim"];
    const orderBy = validSortFields.includes(_sort) ? { [_sort]: order } : { dataInicio: "desc" };

    const phases = await prisma.faseManutencao.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy,
      include: {
        manutencao: {
          select: {
            id: true,
            descricaoProblema: true,
            status: true,
            urgencia: true,
            dataSolicitacao: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
                anoModelo: true,
                cor: true,
                empresa: true,
                departamento: true,
              },
            },
            supervisor: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        },
        oficina: {
          select: {
            nome: true,
            telefone: true,
            rua: true,
            bairro: true,
            cidade: true,
            estado: true,
          },
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          },
        },
      },
    });

    return res.ok({
      data: phases,
      meta: {
        totalItems,
        currentPage: page,
        totalPages,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getPhaseById = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Obter fase de manutenção por ID"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID da fase de manutenção',
      required: true,
      type: 'integer'
    }
    #swagger.responses[200] = { description: "Detalhes da fase de manutenção" }
    #swagger.responses[404] = { description: "Fase de manutenção não encontrada" }
    #swagger.responses[403] = { description: "Acesso proibido" }
  */
  try {
    const { id } = req.params;

    const phase = await prisma.faseManutencao.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        manutencao: {
          select: {
            id: true,
            descricaoProblema: true,
            status: true,
            urgencia: true,
            dataSolicitacao: true,
            supervisorId: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
                anoModelo: true,
                cor: true,
                empresa: true,
                departamento: true,
              },
            },
            supervisor: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        },
        oficina: {
          select: {
            nome: true,
            telefone: true,
            rua: true,
            bairro: true,
            cidade: true,
            estado: true,
          },
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          },
        },
      },
    });

    if (!phase) {
      return res.notFound({ message: "Fase de manutenção não encontrada." });
    }

    // Verifica permissão do supervisor
    if (req.payload && req.payload.funcao === 'supervisor') {
      if (phase.manutencao.supervisorId !== req.payload.id) {
        return res.forbidden({ 
          message: "Acesso Proibido: Você não tem permissão para visualizar esta fase de manutenção." 
        });
      }
    }

    return res.ok(phase);
  } catch (error) {
    return next(error);
  }
};

export const getMaintenancePhases = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Obter todas as fases de uma manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['manutencaoId'] = {
      in: 'path',
      description: 'ID da manutenção',
      required: true,
      type: 'integer'
    }
    #swagger.responses[200] = { description: "Fases da manutenção" }
    #swagger.responses[404] = { description: "Manutenção não encontrada" }
    #swagger.responses[403] = { description: "Acesso proibido" }
  */
  try {
    const { manutencaoId } = req.params;

    // Verifica se a manutenção existe e se o usuário tem permissão
    const manutencao = await prisma.manutencao.findUnique({
      where: { id: parseInt(manutencaoId) },
      select: { id: true, supervisorId: true }
    });

    if (!manutencao) {
      return res.notFound({ message: "Manutenção não encontrada." });
    }

    // Verifica permissão do supervisor
    if (req.payload && req.payload.funcao === 'supervisor') {
      if (manutencao.supervisorId !== req.payload.id) {
        return res.forbidden({ 
          message: "Acesso Proibido: Você não tem permissão para visualizar as fases desta manutenção." 
        });
      }
    }

    const phases = await prisma.faseManutencao.findMany({
      where: {
        manutencaoId: parseInt(manutencaoId),
      },
      orderBy: {
        dataInicio: 'asc'
      },
      include: {
        oficina: {
          select: {
            nome: true,
            telefone: true,
          },
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          },
        },
      },
    });

    return res.ok(phases);
  } catch (error) {
    return next(error);
  }
};

export const createPhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Criar nova fase de manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados da nova fase',
      required: true,
      schema: {
        manutencaoId: 1,
        tipoFase: "INICIAR_VIAGEM",
        oficinaId: 1,
        observacoes: "Iniciando viagem para a oficina"
      }
    }
  */
  try {
    const { manutencaoId } = req.params;
    const { tipoFase, oficinaId, observacoes } = req.body;
    // Valida se a fase é válida
    const fasesValidas = ['INICIAR_VIAGEM', 'DEIXAR_VEICULO', 'SERVICO_FINALIZADO', 'RETORNO_VEICULO', 'VEICULO_ENTREGUE'];
    if (!fasesValidas.includes(tipoFase)) {
      return res.badRequest({ message: "Tipo de fase inválido." });
    }

    // Verifica se a manutenção existe
    const manutencao = await prisma.manutencao.findUnique({
      where: { id: parseInt(manutencaoId) },
      select: { id: true, supervisorId: true, status: true }
    });

    if (!manutencao) {
      return res.notFound({ message: "Manutenção não encontrada." });
    }

    // Verifica permissão
    if (req.payload.funcao === 'supervisor' && manutencao.supervisorId !== req.payload.id) {
      return res.forbidden({ message: "Você não tem permissão para criar fases nesta manutenção." });
    }

    // Finaliza a fase ativa anterior (se existir)
    await prisma.faseManutencao.updateMany({
      where: {
        manutencaoId: parseInt(manutencaoId),
        ativo: true
      },
      data: {
        ativo: false,
        dataFim: new Date()
      }
    });

    // Cria a nova fase
    const newPhase = await prisma.faseManutencao.create({
      data: {
        manutencaoId: parseInt(manutencaoId),
        tipoFase,
        oficinaId: oficinaId ? parseInt(oficinaId) : null,
        responsavelId: req.payload.id,
        observacoes,
        ativo: true
      },
      include: {
        manutencao: {
          select: {
            id: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
              }
            }
          }
        },
        oficina: {
          select: {
            nome: true,
          }
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          }
        }
      }
    });

    return res.created(newPhase);
  } catch (error) {
    return next(error);
  }
};

export const updatePhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Atualizar fase de manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID da fase de manutenção',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados para atualização',
      required: true,
      schema: {
        observacoes: "Fase atualizada",
        finalizar: false
      }
    }
  */
  try {
    const { id } = req.params;
    const { observacoes, finalizar } = req.body;

    // Validar se o ID foi fornecido
    if (!id || isNaN(parseInt(id))) {
      return res.badRequest({ message: "ID da fase é obrigatório e deve ser um número válido." });
    }

    const phaseId = parseInt(id);

    // Buscar a fase de manutenção
    const phase = await prisma.faseManutencao.findUnique({
      where: { id: phaseId },
      include: {
        manutencao: {
          select: {
            id: true,
            supervisorId: true,
          }
        },
        responsavel: {
          select: {
            id: true,
          }
        }
      }
    });

    if (!phase) {
      return res.notFound({ message: "Fase de manutenção não encontrada." });
    }

    // Verifica permissões
    const canUpdate = 
      req.payload.funcao === 'analista' || // Analista pode atualizar qualquer fase
      (req.payload.funcao === 'supervisor' && phase.manutencao.supervisorId === req.payload.id) || // Supervisor da manutenção
      phase.responsavelId === req.payload.id; // Responsável pela fase

    if (!canUpdate) {
      return res.forbidden({ message: "Você não tem permissão para atualizar esta fase." });
    }

    // Preparar dados para atualização
    const updateData = {};
    
    if (observacoes !== undefined) {
      updateData.observacoes = observacoes;
    }

    if (finalizar === true) {
      // Verificar se a fase já foi finalizada
      if (phase.dataFim) {
        return res.badRequest({ message: "Esta fase já foi finalizada." });
      }
      
      updateData.ativo = false;
      updateData.dataFim = new Date();
      
      // Se não tem data de início, definir agora
      if (!phase.dataInicio) {
        updateData.dataInicio = new Date();
      }
    }

    // Se não há dados para atualizar
    if (Object.keys(updateData).length === 0) {
      return res.badRequest({ message: "Nenhum dado fornecido para atualização." });
    }

    // Atualizar a fase
    const updatedPhase = await prisma.faseManutencao.update({
      where: { id: phaseId },
      data: updateData,
      include: {
        manutencao: {
          select: {
            id: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
              }
            }
          }
        },
        oficina: {
          select: {
            nome: true,
          }
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          }
        }
      }
    });

    // Se a fase foi finalizada, verificar se todas as fases da manutenção foram concluídas
    if (finalizar === true) {
      const allPhases = await prisma.faseManutencao.findMany({
        where: { 
          manutencaoId: phase.manutencaoId 
        },
        select: {
          id: true,
          ativo: true,
          dataFim: true
        }
      });

      // Verificar se todas as fases foram finalizadas
      const allPhasesCompleted = allPhases.every(phase => !phase.ativo && phase.dataFim);

      if (allPhasesCompleted) {
        // Atualizar o status da manutenção para concluída
        await prisma.manutencao.update({
          where: { id: phase.manutencaoId },
          data: { 
            status: 'concluída',
            dataFinalizacao: new Date()
          }
        });
      }
    }

    return res.ok({
      message: finalizar === true ? "Fase finalizada com sucesso." : "Fase atualizada com sucesso.",
      data: updatedPhase
    });

  } catch (error) {
    console.error('Erro ao atualizar fase:', error);
    return next(error);
  }
};

// Função auxiliar para iniciar uma fase
export const startPhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Iniciar fase de manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID da fase de manutenção',
      required: true,
      type: 'integer'
    }
  */
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.badRequest({ message: "ID da fase é obrigatório e deve ser um número válido." });
    }

    const phaseId = parseInt(id);

    const phase = await prisma.faseManutencao.findUnique({
      where: { id: phaseId },
      include: {
        manutencao: {
          select: {
            id: true,
            supervisorId: true,
          }
        }
      }
    });

    if (!phase) {
      return res.notFound({ message: "Fase de manutenção não encontrada." });
    }

    // Verifica permissões
    const canStart = 
      req.payload.funcao === 'analista' || 
      (req.payload.funcao === 'supervisor' && phase.manutencao.supervisorId === req.payload.id) || 
      phase.responsavelId === req.payload.id;

    if (!canStart) {
      return res.forbidden({ message: "Você não tem permissão para iniciar esta fase." });
    }

    // Verificar se a fase já foi iniciada
    if (phase.dataInicio) {
      return res.badRequest({ message: "Esta fase já foi iniciada." });
    }

    // Verificar se a fase já foi finalizada
    if (phase.dataFim) {
      return res.badRequest({ message: "Esta fase já foi finalizada." });
    }

    const updatedPhase = await prisma.faseManutencao.update({
      where: { id: phaseId },
      data: { 
        dataInicio: new Date(),
        ativo: true
      },
      include: {
        manutencao: {
          select: {
            id: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
              }
            }
          }
        },
        oficina: {
          select: {
            nome: true,
          }
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          }
        }
      }
    });

    return res.ok({
      message: "Fase iniciada com sucesso.",
      data: updatedPhase
    });

  } catch (error) {
    console.error('Erro ao iniciar fase:', error);
    return next(error);
  }
};

export const advanceToNextPhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Avançar para próxima fase da manutenção ou finalizar última fase"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['manutencaoId'] = {
      in: 'path',
      description: 'ID da manutenção',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados da próxima fase ou finalização',
      required: false,
      schema: {
        oficinaId: 1,
        observacoes: "Avançando para próxima fase ou finalizando"
      }
    }
  */
  try {
    const { manutencaoId } = req.params;
    const { oficinaId, observacoes } = req.body;

    // Validação do manutencaoId
    if (!manutencaoId || isNaN(parseInt(manutencaoId))) {
      return res.badRequest({ message: "ID da manutenção é obrigatório e deve ser um número válido." });
    }

    // Busca a fase ativa atual
    const currentPhase = await prisma.faseManutencao.findFirst({
      where: {
        manutencaoId: parseInt(manutencaoId),
        ativo: true
      },
      include: {
        manutencao: {
          select: {
            id: true,
            supervisorId: true,
            status: true
          }
        }
      }
    });

    if (!currentPhase) {
      return res.notFound({ message: "Nenhuma fase ativa encontrada para esta manutenção." });
    }

    // ✅ VALIDAÇÃO DE RESPONSABILIDADE POR FASE
    const responsavelPorFase = {
      'INICIAR_VIAGEM': 'supervisor',
      'DEIXAR_VEICULO': 'supervisor',
      'SERVICO_FINALIZADO': 'analista',
      'RETORNO_VEICULO': 'supervisor',
      'VEICULO_ENTREGUE': 'supervisor',
    };

    const responsavelFaseAtual = responsavelPorFase[currentPhase.tipoFase];
    
    // Verifica se o usuário pode finalizar esta fase específica
    const canFinishCurrentPhase = 
      req.payload.funcao === 'analista' || // Analista pode finalizar qualquer fase
      (req.payload.funcao === responsavelFaseAtual && 
       currentPhase.manutencao.supervisorId === req.payload.id) || // Supervisor responsável pela fase
      currentPhase.responsavelId === req.payload.id; // Quem criou a fase

    if (!canFinishCurrentPhase) {
      return res.forbidden({ 
        message: `Você não tem permissão para finalizar esta fase. Responsável: ${responsavelFaseAtual}` 
      });
    }

    // Define a sequência de fases
    const sequenciaFases = {
      'INICIAR_VIAGEM': 'DEIXAR_VEICULO',
      'DEIXAR_VEICULO': 'SERVICO_FINALIZADO',
      'SERVICO_FINALIZADO': 'RETORNO_VEICULO',
      'RETORNO_VEICULO': 'VEICULO_ENTREGUE',
      'VEICULO_ENTREGUE': null // ✅ Última fase - não há próxima
    };

    const proximaFase = sequenciaFases[currentPhase.tipoFase];
    
    // ✅ FINALIZA A FASE ATUAL (sempre)
    await prisma.faseManutencao.update({
      where: { id: currentPhase.id },
      data: {
        ativo: false,
        dataFim: new Date(),
        observacoes: observacoes || currentPhase.observacoes // Atualiza observações se fornecidas
      }
    });

    // ✅ Se é a última fase, finaliza a manutenção
    if (!proximaFase) {
      // Finalizar manutenção
      await prisma.manutencao.update({
        where: { id: parseInt(manutencaoId) },
        data: { 
          status: 'concluida',
          dataFinalizacao: new Date()
        }
      });

      // Retorna a fase finalizada
      const finalizedPhase = await prisma.faseManutencao.findUnique({
        where: { id: currentPhase.id },
        include: {
          manutencao: {
            select: {
              id: true,
              status: true,
              veiculo: {
                select: {
                  placa: true,
                  marca: true,
                  modelo: true,
                }
              }
            }
          },
          oficina: {
            select: {
              nome: true,
            }
          },
          responsavel: {
            select: {
              nome: true,
              funcao: true,
            }
          }
        }
      });

      return res.ok({
        message: "Última fase finalizada! Manutenção concluída com sucesso.",
        data: finalizedPhase,
        maintenanceCompleted: true
      });
    }

    // ✅ Se não é a última fase, cria a próxima
    const nextPhase = await prisma.faseManutencao.create({
      data: {
        manutencaoId: parseInt(manutencaoId),
        tipoFase: proximaFase,
        oficinaId: oficinaId ? parseInt(oficinaId) : currentPhase.oficinaId,
        responsavelId: req.payload.id,
        observacoes: null, // Nova fase começa sem observações
        ativo: true,
        dataInicio: new Date() // ✅ Inicia automaticamente a próxima fase
      },
      include: {
        manutencao: {
          select: {
            id: true,
            status: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
              }
            }
          }
        },
        oficina: {
          select: {
            nome: true,
          }
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          }
        }
      }
    });

    return res.ok({
      message: `Fase '${currentPhase.tipoFase}' finalizada e '${proximaFase}' iniciada com sucesso.`,
      data: nextPhase,
      previousPhase: currentPhase.tipoFase,
      nextPhase: proximaFase
    });

  } catch (error) {
    console.error('Erro ao avançar fase:', error);
    return next(error);
  }
};

// ✅ FUNÇÃO AUXILIAR PARA FINALIZAR APENAS A FASE ATUAL (SEM CRIAR PRÓXIMA)
export const finishCurrentPhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance Phases"]
    #swagger.summary = "Finalizar apenas a fase atual sem criar próxima"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['manutencaoId'] = {
      in: 'path',
      description: 'ID da manutenção',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Observações para finalização',
      required: false,
      schema: {
        observacoes: "Fase finalizada"
      }
    }
  */
  try {
    const { manutencaoId } = req.params;
    const { observacoes } = req.body;

    // Busca a fase ativa atual
    const currentPhase = await prisma.faseManutencao.findFirst({
      where: {
        manutencaoId: parseInt(manutencaoId),
        ativo: true
      },
      include: {
        manutencao: {
          select: {
            supervisorId: true,
          }
        }
      }
    });

    if (!currentPhase) {
      return res.notFound({ message: "Nenhuma fase ativa encontrada para esta manutenção." });
    }

    // Verifica permissões
    const canFinish = 
      req.payload.funcao === 'analista' || 
      (req.payload.funcao === 'supervisor' && currentPhase.manutencao.supervisorId === req.payload.id) ||
      currentPhase.responsavelId === req.payload.id;

    if (!canFinish) {
      return res.forbidden({ message: "Você não tem permissão para finalizar esta fase." });
    }

    // Finaliza apenas a fase atual
    const finishedPhase = await prisma.faseManutencao.update({
      where: { id: currentPhase.id },
      data: {
        ativo: false,
        dataFim: new Date(),
        observacoes: observacoes || currentPhase.observacoes
      },
      include: {
        manutencao: {
          select: {
            id: true,
            veiculo: {
              select: {
                placa: true,
                marca: true,
                modelo: true,
              }
            }
          }
        },
        oficina: {
          select: {
            nome: true,
          }
        },
        responsavel: {
          select: {
            nome: true,
            funcao: true,
          }
        }
      }
    });

    // Se é a última fase, finaliza a manutenção
    if (currentPhase.tipoFase === 'VEICULO_ENTREGUE') {
      await prisma.manutencao.update({
        where: { id: parseInt(manutencaoId) },
        data: { 
          status: 'concluida',
          dataFinalizacao: new Date()
        }
      });

      return res.ok({
        message: "Última fase finalizada! Manutenção concluída.",
        data: finishedPhase,
        maintenanceCompleted: true
      });
    }

    return res.ok({
      message: "Fase finalizada com sucesso.",
      data: finishedPhase
    });

  } catch (error) {
    console.error('Erro ao finalizar fase:', error);
    return next(error);
  }
};