import prisma from "../config/database.js";

export const list = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "List all vehicles with maintenance status"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.parameters['_limit'] = {
        in: 'query',
        description: 'Number of items per page',
        required: false,
        type: 'integer',
        default: 10
      }
      #swagger.parameters['_sort'] = {
        in: 'query',
        description: 'Field to sort by (id, placa, marca, modelo, etc)',
        required: false,
        type: 'string'
      }
      #swagger.parameters['_order'] = {
        in: 'query',
        description: 'Order direction (asc or desc)',
        required: false,
        type: 'string',
        enum: ['asc', 'desc']
      }
      #swagger.parameters['status'] = {
        in: 'query',
        description: 'Filter by maintenance status (em_manutencao or em_frota)',
        required: false,
        type: 'string',
        enum: ['em_manutencao', 'em_frota']
      }
      #swagger.responses[200] = {
        description: "List of vehicles with maintenance status and pagination",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      placa: { type: "string", example: "ABC1D23" },
                      marca: { type: "string", example: "Ford" },
                      modelo: { type: "string", example: "Fiesta" },
                      anoFabricacao: { type: "integer", example: 2020 },
                      anoModelo: { type: "integer", example: 2021 },
                      cor: { type: "string", example: "Prata" },
                      statusManutencao: { type: "string", example: "Em frota", enum: ["Em manutenção", "Em frota"] },
                      manutencaoAtiva: {
                        type: "object",
                        nullable: true,
                        properties: {
                          id: { type: "integer", example: 15 },
                          status: { type: "string", example: "aprovada" },
                          dataSolicitacao: { type: "string", format: "date-time" },
                          descricaoProblema: { type: "string", example: "Problema no motor" },
                          faseAtual: {
                            type: "object",
                            nullable: true,
                            properties: {
                              tipoFase: { type: "string", example: "SERVICO_FINALIZADO" },
                              descricaoFase: { type: "string", example: "Serviço finalizado" },
                              emAndamento: { type: "boolean", example: true }
                            }
                          }
                        }
                      },
                      supervisor: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          nome: { type: "string", example: "João Silva" },
                          email: { type: "string", example: "joao@empresa.com" }
                        }
                      }
                    }
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    totalItems: { type: "integer", example: 100 },
                    currentPage: { type: "integer", example: 1 },
                    totalPages: { type: "integer", example: 10 },
                    itemsPerPage: { type: "integer", example: 10 },
                    hasNextPage: { type: "boolean", example: true },
                    hasPrevPage: { type: "boolean", example: false },
                    statusCount: {
                      type: "object",
                      properties: {
                        emManutencao: { type: "integer", example: 15 },
                        emFrota: { type: "integer", example: 85 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
        let whereClause = {};
        if (req.payload && req.payload.funcao === 'supervisor') {
          // Se for supervisor, filtra apenas os veiculos relacionados a ele
          whereClause.supervisorId = req.payload.id;
        }

        const page = parseInt(req.query._page) || 1;
        const limit = parseInt(req.query._limit) || 10;
        const offset = (page - 1) * limit;

        // Primeiro, buscar todos os veículos com suas manutenções ativas
        const veiculosComManutencao = await prisma.veiculo.findMany({
            where: whereClause,
            include: {
                supervisor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                manutencoes: {
                    where: {
                        status: {
                            in: ['aprovada', 'Em analise'] // Manutenções ativas
                        }
                    },
                    orderBy: {
                        dataSolicitacao: 'desc'
                    },
                    take: 1, // Pegar apenas a manutenção mais recente
                    include: {
                        fases: {
                            where: {
                                ativo: true
                            },
                            orderBy: {
                                dataInicio: 'desc'
                            },
                            take: 1
                        },
                        oficina: {
                            select: {
                                id: true,
                                nome: true
                            }
                        }
                    }
                }
            }
        });

        // Processar os dados para incluir status de manutenção
        const veiculosProcessados = veiculosComManutencao.map(veiculo => {
            const manutencaoAtiva = veiculo.manutencoes.length > 0 ? veiculo.manutencoes[0] : null;
            const faseAtual = manutencaoAtiva?.fases.length > 0 ? manutencaoAtiva.fases[0] : null;
            
            const statusManutencao = manutencaoAtiva ? 'Em manutenção' : 'Em frota';
            
            return {
                ...veiculo,
                statusManutencao,
                manutencaoAtiva: manutencaoAtiva ? {
                    id: manutencaoAtiva.id,
                    status: manutencaoAtiva.status,
                    dataSolicitacao: manutencaoAtiva.dataSolicitacao,
                    descricaoProblema: manutencaoAtiva.descricaoProblema,
                    urgencia: manutencaoAtiva.urgencia,
                    oficina: manutencaoAtiva.oficina,
                    faseAtual: faseAtual ? {
                        id: faseAtual.id,
                        tipoFase: faseAtual.tipoFase,
                        descricaoFase: getFaseDescription(faseAtual.tipoFase),
                        dataInicio: faseAtual.dataInicio,
                        dataFim: faseAtual.dataFim,
                        emAndamento: !faseAtual.dataFim,
                        observacoes: faseAtual.observacoes
                    } : null
                } : null,
                // Remover o array de manutenções para não sobrecarregar a resposta
                manutencoes: undefined
            };
        });

        // Aplicar filtro de status se fornecido
        let veiculosFiltrados = veiculosProcessados;
        if (req.query.status) {
            const statusFiltro = req.query.status === 'em_manutencao' ? 'Em manutenção' : 'Em frota';
            veiculosFiltrados = veiculosProcessados.filter(v => v.statusManutencao === statusFiltro);
        }

        // Aplicar ordenação se especificada
        const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
        const sort = req.query._sort;
        const validSortFields = ["id", "placa", "marca", "modelo", "anoFabricacao", "anoModelo"];
        
        if (validSortFields.includes(sort)) {
            veiculosFiltrados.sort((a, b) => {
                let aVal = a[sort];
                let bVal = b[sort];
                
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (order === 'desc') {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                } else {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }
            });
        }

        // Aplicar paginação
        const totalItems = veiculosFiltrados.length;
        const totalPages = Math.ceil(totalItems / limit);
        const veiculosPaginados = veiculosFiltrados.slice(offset, offset + limit);

        // Calcular estatísticas de status
        const statusCount = {
            emManutencao: veiculosProcessados.filter(v => v.statusManutencao === 'Em manutenção').length,
            emFrota: veiculosProcessados.filter(v => v.statusManutencao === 'Em frota').length
        };

        return res.ok({
            data: veiculosPaginados,
            meta: {
                totalItems,
                currentPage: page,
                totalPages,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                statusCount
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Função auxiliar para obter descrição amigável das fases
function getFaseDescription(tipoFase) {
    const faseDescriptions = {
        'INICIAR_VIAGEM': 'Iniciando viagem até a mecânica',
        'DEIXAR_VEICULO': 'Deixando veículo para manutenção',
        'SERVICO_FINALIZADO': 'Serviço finalizado',
        'RETORNO_VEICULO': 'Retornando com veículo',
        'VEICULO_ENTREGUE': 'Veículo entregue/finalizado'
    };
    
    return faseDescriptions[tipoFase] || tipoFase;
}

export const getById = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Get vehicle by ID"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.responses[200] = {
        description: "Vehicle details",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "integer", example: 1 },
                placa: { type: "string", example: "ABC1D23" },
                marca: { type: "string", example: "Ford" },
                modelo: { type: "string", example: "Fiesta" },
                anoFabricacao: { type: "integer", example: 2020 },
                anoModelo: { type: "integer", example: 2021 },
                cor: { type: "string", example: "Prata" },
                renavam: { type: "string", example: "12345678901" },
                chassi: { type: "string", example: "9BWZZZ377VT004251" },
                empresa: { type: "string", example: "Empresa X" },
                departamento: { type: "string", example: "Logística" },
                tipoVeiculo: { type: "string", example: "carro" },
                supervisorId: { type: "integer", example: 1 },
                supervisor: {
                  type: "object",
                  properties: {
                    id: { type: "integer", example: 1 },
                    nome: { type: "string", example: "João Silva" },
                    email: { type: "string", example: "joao@empresa.com" }
                  }
                },
                manutencoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      data: { type: "string", format: "date-time", example: "2023-01-15T10:30:00Z" },
                      descricao: { type: "string", example: "Troca de óleo" }
                    }
                  }
                }
              }
            }
          }
        }
      }
      #swagger.responses[404] = {
        description: "Vehicle not found"
      }
    */
    try {
        const id = parseInt(req.params.id);
        const veiculo = await prisma.veiculo.findUnique({
            where: { id },
            include: {
                supervisor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                },
                manutencoes: true
            }
        });

        if (!veiculo) return res.notFound("Veículo não encontrado.");

        return res.ok(res.hateos_item(veiculo));
    } catch (error) {
        return next(error);
    }
};

export const create = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Create new vehicle"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                placa: { 
                  type: "string", 
                  example: "ABC1D23",
                  description: "Formato AAA1A11 ou AAA1234" 
                },
                marca: { type: "string", example: "Ford" },
                modelo: { type: "string", example: "Fiesta" },
                anoFabricacao: { 
                  type: "integer", 
                  example: 2020,
                  minimum: 1900 
                },
                anoModelo: { 
                  type: "integer", 
                  example: 2021,
                  minimum: 1900 
                },
                cor: { type: "string", example: "Prata" },
                renavam: { 
                  type: "string", 
                  example: "12345678901",
                  description: "11 dígitos" 
                },
                chassi: { 
                  type: "string", 
                  example: "9BWZZZ377VT004251",
                  description: "17 caracteres" 
                },
                empresa: { type: "string", example: "Empresa X" },
                departamento: { type: "string", example: "Logística" },
                tipoVeiculo: { 
                  type: "string", 
                  enum: ["carro", "moto", "caminhão", "ônibus", "van"],
                  example: "carro" 
                },
                supervisorId: { type: "integer", example: 1 }
              },
              required: [
                "placa", "marca", "modelo", "anoFabricacao", "anoModelo",
                "cor", "renavam", "chassi", "empresa", "departamento",
                "tipoVeiculo", "supervisorId"
              ]
            }
          }
        }
      }
      #swagger.responses[201] = {
        description: "Vehicle created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "integer", example: 1 },
                placa: { type: "string", example: "ABC1D23" },
                marca: { type: "string", example: "Ford" },
                modelo: { type: "string", example: "Fiesta" },
                anoFabricacao: { type: "integer", example: 2020 },
                anoModelo: { type: "integer", example: 2021 },
                cor: { type: "string", example: "Prata" },
                supervisorId: { type: "integer", example: 1 }
              }
            }
          }
        }
      }
    */
    try {
        // Verifica se a placa já existe
        const placaExists = await prisma.veiculo.findUnique({
            where: { placa: req.body.placa }
        });

        if (placaExists) {
            return res.badRequest("Já existe um veículo com esta placa.");
        }

        const veiculo = await prisma.veiculo.create({
            data: req.body
        });

        return res.created(res.hateos_item(veiculo));
    } catch (error) {
        return next(error);
    }
};

export const update = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Update vehicle"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                placa: { 
                  type: "string", 
                  example: "ABC1D23",
                  description: "Formato AAA1A11 ou AAA1234" 
                },
                marca: { type: "string", example: "Ford" },
                modelo: { type: "string", example: "Fiesta" },
                anoFabricacao: { 
                  type: "integer", 
                  example: 2020,
                  minimum: 1900 
                },
                anoModelo: { 
                  type: "integer", 
                  example: 2021,
                  minimum: 1900 
                },
                cor: { type: "string", example: "Prata" },
                renavam: { 
                  type: "string", 
                  example: "12345678901",
                  description: "11 dígitos" 
                },
                chassi: { 
                  type: "string", 
                  example: "9BWZZZ377VT004251",
                  description: "17 caracteres" 
                },
                empresa: { type: "string", example: "Empresa X" },
                departamento: { type: "string", example: "Logística" },
                tipoVeiculo: { 
                  type: "string", 
                  enum: ["carro", "moto", "caminhão", "ônibus", "van"],
                  example: "carro" 
                },
                supervisorId: { type: "integer", example: 1 }
              }
            }
          }
        }
      }
      #swagger.responses[200] = {
        description: "Vehicle updated",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "integer", example: 1 },
                placa: { type: "string", example: "ABC1D23" },
                marca: { type: "string", example: "Ford" },
                modelo: { type: "string", example: "Fiesta" },
                anoFabricacao: { type: "integer", example: 2020 },
                anoModelo: { type: "integer", example: 2021 },
                cor: { type: "string", example: "Prata" },
                supervisorId: { type: "integer", example: 1 }
              }
            }
          }
        }
      }
      #swagger.responses[404] = {
        description: "Vehicle not found"
      }
    */
    try {
        const id = parseInt(req.params.id);
        
        // Verifica se o veículo existe
        const veiculoExistente = await prisma.veiculo.findUnique({ where: { id } });
        if (!veiculoExistente) {
            return res.notFound("Veículo não encontrado.");
        }

        // Se a placa foi alterada, verifica se a nova já existe
        if (req.body.placa && req.body.placa !== veiculoExistente.placa) {
            const placaExists = await prisma.veiculo.findUnique({
                where: { placa: req.body.placa }
            });
            if (placaExists) {
                return res.badRequest("Já existe um veículo com esta placa.");
            }
        }

        const veiculo = await prisma.veiculo.update({
            where: { id },
            data: req.body
        });

        return res.ok(res.hateos_item(veiculo));
    } catch (error) {
        return next(error);
    }
};

export const remove = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Delete vehicle"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.responses[204] = {
        description: "Vehicle deleted successfully"
      }
      #swagger.responses[404] = {
        description: "Vehicle not found"
      }
    */
    try {
        const id = parseInt(req.params.id);
        
        // Verifica se o veículo existe
        const veiculo = await prisma.veiculo.findUnique({ where: { id } });
        if (!veiculo) {
            return res.notFound("Veículo não encontrado.");
        }

        await prisma.veiculo.delete({ where: { id } });
        return res.noContent();
    } catch (error) {
        return next(error);
    }
};

export const getAvailable = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Get vehicles not in maintenance with 'Em andamento' status"
      #swagger.description = "Returns all vehicles that are not currently in maintenance with status 'Em andamento'"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.parameters['_limit'] = {
        in: 'query',
        description: 'Number of items per page',
        required: false,
        type: 'integer',
        default: 10
      }
      #swagger.parameters['_sort'] = {
        in: 'query',
        description: 'Field to sort by (id, placa, marca, modelo, etc)',
        required: false,
        type: 'string'
      }
      #swagger.parameters['_order'] = {
        in: 'query',
        description: 'Order direction (asc or desc)',
        required: false,
        type: 'string',
        enum: ['asc', 'desc']
      }
      #swagger.responses[200] = {
        description: "List of available vehicles with pagination",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      placa: { type: "string", example: "ABC1D23" },
                      marca: { type: "string", example: "Ford" },
                      modelo: { type: "string", example: "Fiesta" },
                      anoFabricacao: { type: "integer", example: 2020 },
                      anoModelo: { type: "integer", example: 2021 },
                      cor: { type: "string", example: "Prata" },
                      tipoVeiculo: { type: "string", example: "carro" },
                      supervisor: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          nome: { type: "string", example: "João Silva" },
                          email: { type: "string", example: "joao@empresa.com" }
                        }
                      }
                    }
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    totalItems: { type: "integer", example: 50 },
                    currentPage: { type: "integer", example: 1 },
                    totalPages: { type: "integer", example: 5 },
                    itemsPerPage: { type: "integer", example: 10 },
                    hasNextPage: { type: "boolean", example: true },
                    hasPrevPage: { type: "boolean", example: false }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
        let whereClause = {
          // Exclui veículos que têm manutenções com status diferente de 'reprovada' ou 'concluída'
          NOT: {
              manutencoes: {
                  some: {
                      status: {
                          // This finds any maintenance where the status is NOT 'reprovada' AND NOT 'concluída'
                          // In other words, it finds 'pendente', 'em andamento', etc.
                          notIn: ["reprovada", "concluída"]
                      }
                  }
              }
          }
      };

        // Se for supervisor, filtra apenas os veículos relacionados a ele
        if (req.payload && req.payload.funcao === 'supervisor') {
            whereClause.supervisorId = req.payload.id;
        }
        const page = parseInt(req.query._page) || 1;
        const limit = parseInt(req.query._limit) || 10;
        const offset = (page - 1) * limit;

        // Conta total de veículos disponíveis
        const totalItems = await prisma.veiculo.count({
            where: whereClause
        });
        
        const totalPages = Math.ceil(totalItems / limit);

        const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
        const sort = req.query._sort;
        const validSortFields = ["id", "placa", "marca", "modelo", "anoFabricacao", "anoModelo", "tipoVeiculo"];
        const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

        const veiculosDisponiveis = await prisma.veiculo.findMany({
            where: whereClause,
            skip: offset,
            take: limit,
            ...(orderBy && { orderBy }),
            include: {
                supervisor: {
                    select: {
                        id: true,
                        nome: true,
                        email: true
                    }
                }
            }
        });

        return res.ok(res.hateos_list("veiculosDisponiveis", veiculosDisponiveis, totalPages));
    } catch (error) {
        return next(error);
    }
};

export const getVehiclesWithoutSupervisor = async (req, res, next) => {
    /*
      #swagger.tags = ["Veiculos"]
      #swagger.summary = "Get vehicles without supervisor"
      #swagger.description = "Returns all vehicles that don't have a supervisor assigned or have an invalid supervisor reference"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.parameters['_page'] = {
        in: 'query',
        description: 'Page number',
        required: false,
        type: 'integer',
        default: 1
      }
      #swagger.parameters['_limit'] = {
        in: 'query',
        description: 'Number of items per page',
        required: false,
        type: 'integer',
        default: 10
      }
      #swagger.parameters['_sort'] = {
        in: 'query',
        description: 'Field to sort by (id, placa, marca, modelo, etc)',
        required: false,
        type: 'string'
      }
      #swagger.parameters['_order'] = {
        in: 'query',
        description: 'Order direction (asc or desc)',
        required: false,
        type: 'string',
        enum: ['asc', 'desc']
      }
      #swagger.responses[200] = {
        description: "List of vehicles without supervisor with pagination",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      placa: { type: "string", example: "ABC1D23" },
                      marca: { type: "string", example: "Ford" },
                      modelo: { type: "string", example: "Fiesta" },
                      anoFabricacao: { type: "integer", example: 2020 },
                      anoModelo: { type: "integer", example: 2021 },
                      cor: { type: "string", example: "Prata" },
                      renavam: { type: "string", example: "12345678901" },
                      chassi: { type: "string", example: "9BWZZZ377VT004251" },
                      empresa: { type: "string", example: "Empresa X" },
                      departamento: { type: "string", example: "Logística" },
                      tipoVeiculo: { type: "string", example: "carro" },
                      supervisorId: { type: "integer", example: null },
                      supervisor: { type: "null", example: null }
                    }
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    totalItems: { type: "integer", example: 5 },
                    currentPage: { type: "integer", example: 1 },
                    totalPages: { type: "integer", example: 1 },
                    itemsPerPage: { type: "integer", example: 10 },
                    hasNextPage: { type: "boolean", example: false },
                    hasPrevPage: { type: "boolean", example: false }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
        const whereClause = {
            OR: [
                { supervisorId: null },
                { supervisor: null }
            ]
        };

        const page = parseInt(req.query._page) || 1;
        const limit = parseInt(req.query._limit) || 10;
        const offset = (page - 1) * limit;

        // Conta total de veículos sem supervisor
        const totalItems = await prisma.veiculo.count({
            where: whereClause
        });
        
        const totalPages = Math.ceil(totalItems / limit);

        const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
        const sort = req.query._sort;
        const validSortFields = ["id", "placa", "marca", "modelo", "anoFabricacao", "anoModelo", "tipoVeiculo"];
        const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

        const veiculosSemSupervisor = await prisma.veiculo.findMany({
            where: whereClause,
            skip: offset,
            take: limit,
            ...(orderBy && { orderBy }),
            include: {
                supervisor: true
            }
        });

        return res.ok({
            data: veiculosSemSupervisor,
            meta: {
                totalItems,
                currentPage: page,
                totalPages,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            }
        });
    } catch (error) {
        return next(error);
    }
};
