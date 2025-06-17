import prisma from "../config/database.js";
import { hashPassword } from "../utils/bcrypt.js";
import bcrypt from "bcrypt";


export const listInoperantVehicles = async (req, res, next) => {
  /*
    #swagger.tags = ["Inoperative"]
    #swagger.summary = "Listar veículos inoperantes"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['status'] = {
      in: 'query',
      description: 'Filtrar por status (aprovado/concluido)',
      required: false,
      type: 'string'
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
    const { _page, _limit, _sort, _order, status } = req.query;

    const whereClause = {
      veiculo: {
        manutencoes: {
          some: {
            status: status ? status : { in: ["aprovado", "concluido"] },
          },
        },
      },
    };

    if (req.payload && req.payload.funcao === 'supervisor') {
      whereClause.veiculo = {
        ...whereClause.veiculo,
        supervisorId: req.payload.id,
      };
    }

    const page = parseInt(_page) || 1;
    const limit = parseInt(_limit) || 10;
    const offset = (page - 1) * limit;

    const totalItems = await prisma.inoperante.count({ where: whereClause });
    const totalPages = Math.ceil(totalItems / limit);

    const order = _order?.toLowerCase() === "desc" ? "desc" : "asc";
    const validSortFields = ["id", "veiculoId", "oficinaId", "responsavelId"];
    const orderBy = validSortFields.includes(_sort) ? { [_sort]: order } : undefined;

    const vehicles = await prisma.inoperante.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      ...(orderBy && { orderBy }),
      include: {
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
            anoModelo: true,
            cor: true,
            empresa: true,
            departamento: true,
            supervisor: {
              select: {
                nome: true,
                email: true,
              },
            },
            manutencoes: {
              where: {
                status: status ? status : { in: ["aprovado", "concluido"] },
              },
              select: {
                status: true,
              },
            },
          },
        },
        oficina: {
          select: {
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
          },
        },
      },
    });

    return res.ok({
      data: vehicles,
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


export const getById = async (req, res, next) => {
  /*
    #swagger.tags = ["Inoperative"]
    #swagger.summary = "Obter veículo inoperante por ID"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID do veículo inoperante',
      required: true,
      type: 'integer'
    }
    #swagger.responses[200] = { description: "Detalhes do veículo inoperante" }
    #swagger.responses[404] = { description: "Veículo inoperante não encontrado" }
    #swagger.responses[403] = { description: "Acesso proibido" }
  */
  try {
    const { id } = req.params;

    const inoperante = await prisma.inoperante.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
            anoModelo: true,
            cor: true,
            empresa: true,
            departamento: true,
            supervisor: {
              select: {
                nome: true,
                email: true,
              },
            },
            manutencoes: {
              select: {
                status: true,
                descricaoProblema: true,
                dataSolicitacao: true,
              },
            },
          },
        },
        oficina: {
          select: {
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
          },
        },
      },
    });

    if (!inoperante) {
      return res.not_found({ message: "Registro de veículo inoperante não encontrado." });
    }

    if (req.payload && req.payload.funcao === 'supervisor') {
      if (inoperante.veiculo.supervisor.id !== req.payload.id) {
        return res.forbidden({ message: "Acesso Proibido: Você não tem permissão para visualizar este registro de veículo." });
      }
    }

    return res.ok(inoperante);
  } catch (error) {
    return next(error);
  }
};


export const getPhaseInfo = async (req, res, next) => {
  /*
    #swagger.tags = ["Inoperative"]
    #swagger.summary = "Obter informações da fase atual do veículo inoperante"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID do veículo inoperante',
      required: true,
      type: 'integer'
    }
    #swagger.responses[200] = { 
      description: "Informações da fase",
      schema: {
        id: 1,
        faseAtual: "FASE1",
        updatedAt: "2024-03-20T10:00:00Z",
        veiculo: {
          placa: "ABC1234",
          marca: "Toyota",
          modelo: "Corolla"
        },
        responsavel: {
          nome: "João Silva",
          funcao: "supervisor"
        }
      }
    }
    #swagger.responses[404] = { description: "Veículo inoperante não encontrado" }
    #swagger.responses[403] = { description: "Acesso proibido" }
  */
  try {
    const { id } = req.params;

    const inoperante = await prisma.inoperante.findUnique({
      where: {
        id: parseInt(id),
      },
      select: {
        id: true,
        faseAtual: true,
        updatedAt: true,
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
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

    if (!inoperante) {
      return res.not_found({ message: "Veículo inoperante não encontrado." });
    }

    // Verifica permissão do supervisor
    if (req.payload && req.payload.funcao === 'supervisor') {
      if (inoperante.responsavel.id !== req.payload.id) {
        return res.forbidden({ message: "Acesso Proibido: Você não tem permissão para visualizar este registro." });
      }
    }

    return res.ok(inoperante);
  } catch (error) {
    return next(error);
  }
};


export const updatePhase = async (req, res, next) => {
  /*
    #swagger.tags = ["Inoperative"]
    #swagger.summary = "Atualizar fase do veículo inoperante"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['id'] = {
      in: 'path',
      description: 'ID do veículo inoperante',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados da fase',
      required: true,
      schema: {
        fase: "FASE1"
      }
    }
    #swagger.responses[200] = { 
      description: "Fase atualizada com sucesso",
      schema: {
        id: 1,
        faseAtual: "FASE1",
        updatedAt: "2024-03-20T10:00:00Z",
        veiculo: {
          placa: "ABC1234",
          marca: "Toyota",
          modelo: "Corolla"
        },
        responsavel: {
          nome: "João Silva",
          funcao: "supervisor"
        }
      }
    }
    #swagger.responses[400] = { description: "Fase inválida" }
    #swagger.responses[404] = { description: "Veículo inoperante não encontrado" }
    #swagger.responses[403] = { description: "Acesso proibido ou sem permissão para atualizar" }
  */
  try {
    const { id } = req.params;
    const { fase } = req.body;

    // Valida se a fase é válida
    const fasesValidas = ['FASE1', 'FASE2', 'FASE3', 'FASE4'];
    if (!fasesValidas.includes(fase)) {
      return res.bad_request({ message: "Fase inválida." });
    }

    const inoperante = await prisma.inoperante.findUnique({
      where: { id: parseInt(id) },
      include: {
        responsavel: true,
      }
    });

    // Verifica se o inoperante existe
    if (!inoperante) {
      return res.not_found({ message: "Veículo inoperante não encontrado." });
    }

    // Lógica específica para cada função
    if (req.payload.funcao === 'supervisor') {
      // Verifica se o supervisor é responsável pelo veículo
      if (inoperante.responsavel.id !== req.payload.id) {
        return res.forbidden({ message: "Você não tem permissão para atualizar este registro." });
      }
    } else {
      // Lógica para analista
      // Só pode atualizar para FASE4 e apenas se estiver exatamente na FASE3
      if (fase !== 'FASE4' || inoperante.faseAtual !== 'FASE3') {
        return res.forbidden({ 
          message: "Analistas só podem confirmar a finalização do serviço quando o supervisor indicar que o serviço está finalizado." 
        });
      }
    }

    // Atualiza a fase
    const updated = await prisma.inoperante.update({
      where: { id: parseInt(id) },
      data: { 
        faseAtual: fase,
        updatedAt: new Date()
      },
      include: {
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
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

    return res.ok(updated);
  } catch (error) {
    return next(error);
  }
};

