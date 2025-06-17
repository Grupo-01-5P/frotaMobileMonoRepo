import prisma from "../config/database.js";
import publishEmail from "../services/publish.js";

export const list = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Listar manutenções"
    #swagger.security = [{ "BearerAuth": [] }]
  */
  try {
    const whereClause = {};
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    
    if (req.payload && req.payload.funcao === 'supervisor') {
      // Se for supervisor, filtra apenas as manutenções vinculadas a ele
      whereClause.supervisorId = req.payload.id;
    }
    const page = parseInt(req.query._page) || 1;
    const limit = parseInt(req.query._limit) || 10;
    const offset = (page - 1) * limit;

    const totalItems = await prisma.manutencao.count();
    const totalPages = Math.ceil(totalItems / limit);

    const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
    const sort = req.query._sort;
    const validSortFields = ["id", "urgencia", "status", "dataSolicitacao"];
    const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

    const manutencoes = await prisma.manutencao.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      ...(orderBy && { orderBy }),
      include: {
        veiculo: true,
        supervisor: {
          select: { id: true, nome: true, email: true }
        },
        oficina: true,
      }
    });

    return res.ok(res.hateos_list("manutencoes", manutencoes, totalPages));
  } catch (error) {
    return next(error);
  }
};

export const getById = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Obter manutenção por ID"
    #swagger.security = [{ "BearerAuth": [] }]
  */
  try {
    const id = parseInt(req.params.id);
    const manutencao = await prisma.manutencao.findUnique({
      where: { id },
      include: {
        veiculo: true,
        supervisor: {
          select: { id: true, nome: true, email: true }
        },
        orcamento: true,
        entrega: true
      }
    });

    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada." });
    }

    return res.ok(res.hateos_item(manutencao));
  } catch (error) {
    return next(error);
  }
};

export const create = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Criar nova manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
  */
  try {
    // Criar a manutenção
    const nova = await prisma.manutencao.create({
      data: {
        veiculoId: req.body.veiculoId,
        descricaoProblema: req.body.descricaoProblema,
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
        urgencia: req.body.urgencia,
        status: req.body.status || "pendente",
        supervisorId: req.body.supervisorId
      },
      include: {
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
            empresa: true,
            departamento: true
          }
        },
        supervisor: {
          select: {
            nome: true,
            email: true
          }
        }
      }
    });
    //pegando email de todos os analistas
    const analistas = await prisma.usuario.findMany({
      where: {
        funcao: 'analista',
      },
      select: {
        email: true
      }
    });
    //monta string de emails
    const emails = analistas.map(a => a.email).join(', ');
    // Enviar notificação por email via RabbitMQ
    try {
      await publishEmail({
        to: `${nova.supervisor.email},${emails}`,
        subject: `Nova Manutenção Criada - Veículo ${nova.veiculo.placa}`,
        body: `
        Uma nova manutenção foi criada e requer sua atenção:

        Detalhes da Manutenção:
        - ID: #${nova.id}
        - Veículo: ${nova.veiculo.modelo} - Placa: ${nova.veiculo.placa}
        - Descrição do Problema: ${nova.descricaoProblema}
        - Urgência: ${nova.urgencia.toUpperCase()}
        - Status: ${nova.status.toUpperCase()}
        - Data de Criação: ${new Date(nova.dataSolicitacao).toLocaleString('pt-BR')}

        ${nova.latitude && nova.longitude ? 
          `Localização: Lat: ${nova.latitude}, Lng: ${nova.longitude}` : 
          'Localização não informada'
        }

        Por favor, verifique o sistema para mais detalhes e tome as ações necessárias.

        Atenciosamente,
        Sistema de Manutenção
        `.trim(),
        metadata: {
          maintenanceId: nova.id,
          veiculoId: nova.veiculoId,
          urgencia: nova.urgencia
        }
      });

      console.log(`Notificação de manutenção enviada para: ${nova.supervisor.email}`);
    } catch (emailError) {
      // Log do erro mas não falha a criação da manutenção
      console.error('Erro ao enviar notificação por email:', emailError.message);
      // Você pode optar por salvar o erro em uma tabela de logs
    }

    return res.created(res.hateos_item(nova));
  } catch (error) {
    return next(error);
  }
};

export const update = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Atualizar manutenção existente"
    #swagger.security = [{ "BearerAuth": [] }]
  */
    try {
      const id = parseInt(req.params.id);
      
      // Se os campos latitude ou longitude estiverem presentes, converta para número
      const data = { ...req.body };
      if (data.latitude !== undefined) {
        data.latitude = data.latitude === null ? null : parseFloat(data.latitude);
      }
      if (data.longitude !== undefined) {
        data.longitude = data.longitude === null ? null : parseFloat(data.longitude);
      }
      
      const updated = await prisma.manutencao.update({
        where: { id },
        data
      });
  
      return res.no_content(res.hateos_item(updated));
    } catch (error) {
      return next(error);
    }
};

export const remove = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Deletar manutenção"
    #swagger.security = [{ "BearerAuth": [] }]
  */
  try {
    const id = parseInt(req.params.id);
    await prisma.manutencao.delete({ where: { id } });
    return res.no_content();
  } catch (error) {
    return next(error);
  }
};

export const aprovar = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Aprovar uma manutenção pendente e definir oficina"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.description = "Altera o status da manutenção para 'Aprovada' e define a oficina responsável"
    #swagger.parameters['oficinaId'] = {
      in: 'body',
      description: 'ID da oficina responsável pela manutenção (opcional)',
      required: false,
      type: 'integer'
    }
    #swagger.responses[204] = { description: "Manutenção aprovada com sucesso" }
    #swagger.responses[404] = { description: "Manutenção ou oficina não encontrada" }
    #swagger.responses[400] = { description: "Manutenção não pode ser aprovada pois não está com status pendente" }
  */
  try {
    const id = parseInt(req.params.id);
    const { oficinaId, dataEnviarMecanica } = req.body;
    
    // Verificar se a manutenção existe e buscar dados completos
    const manutencao = await prisma.manutencao.findUnique({
      where: { id },
      include: {
        veiculo: {
          select: {
            placa: true,
            marca: true,
            modelo: true,
            empresa: true,
            departamento: true
          }
        },
        supervisor: {
          select: {
            nome: true,
            email: true
          }
        }
      }
    });
    
    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada." });
    }

    // Verificar se a manutenção está em estado que pode ser aprovada
    if (manutencao.status !== "pendente") {
      return res.status(400).json({ 
        error: `Manutenção não pode ser aprovada pois está com status '${manutencao.status}' ao invés de 'pendente'` 
      });
    }

    let oficina = null;
    // Verificar se a oficina existe, se um ID foi fornecido
    if (oficinaId) {
      oficina = await prisma.oficina.findUnique({
        where: { id: parseInt(oficinaId) }
      });
      
      if (!oficina) {
        return res.status(404).json({ error: "Oficina não encontrada." });
      }
    }

    // Preparar os dados para atualização
    const updateData = { 
      status: "aprovada",
      dataAprovacao: new Date(),
      dataEnviarMecanica: dataEnviarMecanica ? new Date(dataEnviarMecanica) : null
    };

    // Adicionar oficinaId apenas se foi fornecido
    if (oficinaId) {
      updateData.oficinaId = parseInt(oficinaId);
    }

    // Aprovar a manutenção
    const updated = await prisma.manutencao.update({
      where: { id },
      data: updateData,
      include: {
        veiculo: true,
        supervisor: true,
        oficina: true
      }
    });

    // Enviar notificação por email via RabbitMQ
    try {
      let emailBody = `
Olá ${manutencao.supervisor.nome},

Sua solicitação de manutenção foi APROVADA! 🎉

📋 DETALHES DA MANUTENÇÃO:
• ID: #${manutencao.id}
• Status: APROVADA ✅
• Data de Aprovação: ${new Date().toLocaleString('pt-BR')}
• Data de Solicitação: ${new Date(manutencao.dataSolicitacao).toLocaleString('pt-BR')}

🚗 INFORMAÇÕES DO VEÍCULO:
• Placa: ${manutencao.veiculo.placa}
• Marca/Modelo: ${manutencao.veiculo.marca} ${manutencao.veiculo.modelo}
• Empresa: ${manutencao.veiculo.empresa}
• Departamento: ${manutencao.veiculo.departamento}

🔧 DESCRIÇÃO DO PROBLEMA:
${manutencao.descricaoProblema}

🏢 INFORMAÇÕES DA OFICINA:`;

      if (oficina) {
        emailBody += `
• Nome: ${oficina.nome}
• CNPJ: ${oficina.cnpj}
• Endereço: ${oficina.rua}, ${oficina.bairro} - ${oficina.cidade}/${oficina.estado}
• Telefone: ${oficina.telefone}
• Email: ${oficina.email}

📍 PRÓXIMOS PASSOS:
1. Entre em contato com a oficina para agendar a manutenção
2. Leve o veículo na data e horário combinados
3. Mantenha o comprovante da manutenção para registros`;
      } else {
        emailBody += `
• Aguardando definição da oficina responsável
• Você será notificado quando a oficina for definida`;
      }

      emailBody += `

${manutencao.latitude && manutencao.longitude ? 
  `📍 LOCALIZAÇÃO DO PROBLEMA:\nLatitude: ${manutencao.latitude}\nLongitude: ${manutencao.longitude}` : 
  ''
}

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
Sistema de Gestão de Manutenções`;

      await publishEmail({
        to: manutencao.supervisor.email,
        subject: `✅ Manutenção #${manutencao.id} APROVADA - Veículo ${manutencao.veiculo.placa}`,
        body: emailBody.trim(),
        priority: 'high',
        template: 'manutencao-aprovada',
        variables: {
          supervisorNome: manutencao.supervisor.nome,
          manutencaoId: manutencao.id,
          veiculoPlaca: manutencao.veiculo.placa,
          veiculoMarca: manutencao.veiculo.marca,
          veiculoModelo: manutencao.veiculo.modelo,
          empresa: manutencao.veiculo.empresa,
          departamento: manutencao.veiculo.departamento,
          descricaoProblema: manutencao.descricaoProblema,
          dataAprovacao: new Date().toLocaleString('pt-BR'),
          dataSolicitacao: new Date(manutencao.dataSolicitacao).toLocaleString('pt-BR'),
          temOficina: !!oficina,
          oficina: oficina ? {
            nome: oficina.nome,
            cnpj: oficina.cnpj,
            endereco: `${oficina.rua}, ${oficina.bairro} - ${oficina.cidade}/${oficina.estado}`,
            telefone: oficina.telefone,
            email: oficina.email
          } : null,
          temLocalizacao: !!(manutencao.latitude && manutencao.longitude),
          latitude: manutencao.latitude,
          longitude: manutencao.longitude
        },
        metadata: {
          tipo: 'manutencao-aprovada',
          manutencaoId: manutencao.id,
          veiculoId: manutencao.veiculoId,
          supervisorId: manutencao.supervisorId,
          oficinaId: oficinaId || null,
          empresa: manutencao.veiculo.empresa
        }
      });

      console.log(`✅ Notificação de aprovação enviada para: ${manutencao.supervisor.email} (Manutenção #${manutencao.id})`);
    } catch (emailError) {
      // Log do erro mas não falha a aprovação da manutenção
      console.error(`❌ Erro ao enviar notificação de aprovação da manutenção #${manutencao.id}:`, emailError.message);
    }
    
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao aprovar manutenção:", error);
    return next(error);
  }
};

export const reprovar = async (req, res, next) => {
  /*
    #swagger.tags = ["Maintenance"]
    #swagger.summary = "Reprovar uma manutenção pendente"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.description = "Altera o status da manutenção para 'Reprovada'"
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Motivo da reprovação',
      required: false,
      schema: {
        motivoReprovacao: 'Custo muito elevado para o tipo de reparo'
      }
    }
    #swagger.responses[204] = { description: "Manutenção reprovada com sucesso" }
    #swagger.responses[404] = { description: "Manutenção não encontrada" }
    #swagger.responses[400] = { description: "Manutenção não pode ser reprovada pois não está com status pendente" }
  */
  try {
    const id = parseInt(req.params.id);
    
    // Verificar se a manutenção existe e qual o status atual
    const manutencao = await prisma.manutencao.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada." });
    }

    // Verificar se a manutenção está em estado que pode ser reprovada
    if (manutencao.status !== "pendente") {
      return res.status(400).json({ 
        error: `Manutenção não pode ser reprovada pois está com status '${manutencao.status}' ao invés de 'pendente'` 
      });
    }

    // Reprovar a manutenção
    const updated = await prisma.manutencao.update({
      where: { id },
      data: { 
        status: "Reprovada", 
        motivoReprovacao: req.body.motivoReprovacao || null,
        dataReprovacao: new Date() // Opcional: registrar quando foi reprovada
      }
    });

    return res.no_content(res.hateos_item(updated));
  } catch (error) {
    return next(error);
  }
};
