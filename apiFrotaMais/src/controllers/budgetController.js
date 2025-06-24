import prisma from "../config/database.js";
import publishEmail from "../services/publish.js";
import jwt from 'jsonwebtoken';

export const list = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Lista todos os orçamentos"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['_limit'] = {
      in: 'query',
      description: 'Número de itens por página',
      required: false,
      type: 'integer',
      default: 10
    }
    #swagger.parameters['_page'] = {
      in: 'query',
      description: 'Página atual',
      required: false,
      type: 'integer',
      default: 1
    }
    #swagger.parameters['_sort'] = {
      in: 'query',
      description: 'Campo para ordenação (id, descricaoServico, valorMaoObra, status)',
      required: false,
      type: 'string'
    }
    #swagger.parameters['_order'] = {
      in: 'query',
      description: 'Direção da ordenação (asc ou desc)',
      required: false,
      type: 'string',
      enum: ['asc', 'desc']
    }
    #swagger.responses[200] = {
      description: "Lista de orçamentos com paginação"
    }
  */
  try {
    const page = parseInt(req.query._page) || 1;
    const limit = parseInt(req.query._limit) || 10;
    const offset = (page - 1) * limit;

    const totalItems = await prisma.orcamento.count();
    const totalPages = Math.ceil(totalItems / limit);

    const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
    const sort = req.query._sort;
    const validSortFields = ["id", "descricaoServico", "valorMaoObra", "status"];
    const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

    const orcamentos = await prisma.orcamento.findMany({
      skip: offset,
      take: limit,
      ...(orderBy && { orderBy }),
      include: {
        manutencao: {
          select: {
            id: true, // Incluindo id da manutencao para referência
            veiculo: {
              select: {
                placa: true,
              },
            },
          },
        },
        oficina: { // Incluindo informações básicas da oficina
          select: {
            id: true,
            nome: true,
          }
        },
        produtos: {
          include: {
            produto: true,
          },
        },
      },
    });

    return res.ok({
      data: orcamentos,
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
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Busca orçamento por ID"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.responses[200]
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);
    const orcamento = await prisma.orcamento.findUnique({
      where: { id },
      include: {
        manutencao: {
          include: {
            veiculo: true,
          }
        },
        oficina: true,
        produtos: {
          include: {
            produto: true,
          },
        },
      },
    });
    if (!orcamento) return res.status(404).json({ error: "Orçamento não encontrado." });

    return res.ok(res.hateos_item(orcamento));
  } catch (error) {
    return next(error);
  }
};

export const create = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Cria um novo orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              descricaoServico: { type: "string" },
              valorMaoObra: { type: "number" },
              status: { type: "string", default: "pendente", description: "Opcional. Default: 'pendente'" },
              dataEnvio: { type: "string", format: "date-time", description: "Opcional. Se não fornecido, usa a data atual." },
              manutencaoId: { type: "integer" },
              oficinaId: { type: "integer" },
              produtos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    produtoId: { type: "integer" },
                    valorUnitario: { type: "number" },
                    fornecedor: { type: "string" }
                  },
                  required: ["produtoId", "valorUnitario", "fornecedor"]
                },
                description: "Lista de produtos para o orçamento. Opcional."
              }
            },
            required: ["descricaoServico", "valorMaoObra", "manutencaoId", "oficinaId"]
          }
        }
      }
    }
    #swagger.responses[201] = { description: "Orçamento criado com sucesso" }
  */
  try {
    const { produtos, dataEnvio, ...restOfBody } = req.body;

    const dataParaCriar = {
      ...restOfBody,
      ...(dataEnvio && { dataEnvio: new Date(dataEnvio).toISOString() }), 
    };

    if (produtos && Array.isArray(produtos) && produtos.length > 0) {
      dataParaCriar.produtos = {
        create: produtos.map(produto => ({
          produtoId: produto.produtoId,
          valorUnitario: produto.valorUnitario,
          fornecedor: produto.fornecedor,
        })),
      };
    }

    const orcamento = await prisma.orcamento.create({
      data: dataParaCriar,
      include: { 
        manutencao: { include: { veiculo: true } },
        oficina: true,
        produtos: { include: { produto: true } },
      },
    });

    return res.created(res.hateos_item(orcamento));
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('manutencaoId')) {
      return res.status(409).json({ error: "Já existe um orçamento para esta manutenção." });
    }
    return next(error);
  }
};

export const update = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Atualiza um orçamento existente"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              descricaoServico: { type: "string" },
              valorMaoObra: { type: "number" },
              status: { type: "string" },
              dataEnvio: { type: "string", format: "date-time" },
              manutencaoId: { type: "integer", description: "Atenção: alterar pode reassociar o orçamento." },
              oficinaId: { type: "integer" },
              produtos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    produtoId: { type: "integer" },
                    valorUnitario: { type: "number" },
                    fornecedor: { type: "string" }
                  },
                  required: ["produtoId", "valorUnitario", "fornecedor"]
                },
                description: "Lista completa de produtos. Substituirá os produtos existentes. Envie array vazio para remover todos os produtos."
              }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: "Atualizado com sucesso, retorna o orçamento atualizado" }
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);
    const { produtos, dataEnvio, ...restOfBody } = req.body;

    // Verificar se o orçamento existe
    const existingOrcamento = await prisma.orcamento.findUnique({ 
      where: { id },
      include: {
        manutencao: { 
          include: { 
            veiculo: true,
            oficina: true
          }
        },
        oficina: true,
        produtos: { 
          include: { 
            produto: true 
          } 
        },
      },
    });
    
    if (!existingOrcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    
    const updatedOrcamento = await prisma.$transaction(async (tx) => {
      // 1. Atualizar os campos escalares do Orcamento
      await tx.orcamento.update({
        where: { id },
        data: {
          ...restOfBody,
          ...(dataEnvio && { dataEnvio: new Date(dataEnvio).toISOString() }),
        },
      });

      // 2. Gerenciar a relação 'produtos' se 'produtos' for fornecido no corpo da requisição
      if (typeof produtos !== 'undefined') {
        // 2a. Remover todos os ProdutoOrcamento existentes para este orçamento
        await tx.produtoOrcamento.deleteMany({
          where: { orcamentoId: id },
        });

        // 2b. Criar os novos ProdutoOrcamento se a lista não for vazia
        if (Array.isArray(produtos) && produtos.length > 0) {
          await tx.produtoOrcamento.createMany({
            data: produtos.map(p => ({
              orcamentoId: id, // Associar ao orçamento atual
              produtoId: p.produtoId,
              valorUnitario: p.valorUnitario,
              fornecedor: p.fornecedor,
            })),
          });
        }
      }

      // 3. Buscar e retornar o orçamento completamente atualizado
      return tx.orcamento.findUnique({
        where: { id },
        include: {
          manutencao: { 
            include: { 
              veiculo: true,
              oficina: true
            } 
          },
          oficina: true,
          produtos: { 
            include: { 
              produto: true 
            } 
          },
        },
      });
    });

    // Enviar email quando o status for alterado para "aprovado"
    if (restOfBody.status && restOfBody.status.toLowerCase() === "aprovado") {
      try {
        // Calcular valor total do orçamento
        const valorMaoObra = updatedOrcamento.valorMaoObra || 0;
        const valorProdutos = updatedOrcamento.produtos.reduce((total, produto) => {
          return total + (produto.valorUnitario * (produto.quantidade || 1));
        }, 0);
        const valorTotal = valorMaoObra + valorProdutos;

        // Gerar lista de produtos para o email
        const listaProdutos = updatedOrcamento.produtos.length > 0 
          ? updatedOrcamento.produtos.map(produto => 
              `• ${produto.produto.nome} - Qtd: ${produto.quantidade || 1} - R$ ${produto.valorUnitario.toFixed(2)} (Fornecedor: ${produto.fornecedor})`
            ).join('\n        ')
          : '• Nenhum produto adicional';

        await publishEmail({
          to: updatedOrcamento.oficina.email,
          subject: `✅ Orçamento APROVADO - Iniciar Serviço - ${updatedOrcamento.manutencao.veiculo.placa}`,
          body: `
Prezados,

🎉 **ORÇAMENTO APROVADO!**

O orçamento para manutenção foi aprovado e vocês estão autorizados a iniciar o serviço imediatamente.

📋 **Detalhes da Manutenção:**
- ID do Orçamento: #${updatedOrcamento.id}
- ID da Manutenção: #${updatedOrcamento.manutencao.id}
- Veículo: ${updatedOrcamento.manutencao.veiculo.marca} ${updatedOrcamento.manutencao.veiculo.modelo}
- Placa: ${updatedOrcamento.manutencao.veiculo.placa}
- Oficina: ${updatedOrcamento.oficina.nome}
- Data de Aprovação: ${new Date().toLocaleString('pt-BR')}

💰 **Valores Aprovados:**
- Mão de Obra: R$ ${valorMaoObra.toFixed(2)}
- Produtos: R$ ${valorProdutos.toFixed(2)}
- **TOTAL: R$ ${valorTotal.toFixed(2)}**

🔧 **Produtos/Peças Aprovados:**
        ${listaProdutos}

📋 **Descrição do Serviço:**
${updatedOrcamento.descricaoServico || 'Não especificada'}

✅ **Próximos Passos:**
1. Iniciem o serviço conforme orçamento aprovado
2. Utilizem apenas os produtos/peças especificados
3. Mantenham a qualidade e prazos acordados
4. Reportem qualquer imprevisto imediatamente

⚠️ **Importante:**
- Sigam exatamente o que foi orçado e aprovado
- Qualquer alteração deve ser previamente autorizada
- Documenten o progresso do serviço
- Notifiquem quando o serviço estiver concluído

📞 **Contato para Dúvidas:**
Em caso de dúvidas ou imprevistos durante o serviço, entrem em contato com nossa equipe imediatamente.

Confiamos na qualidade do trabalho de vocês. Bom serviço!

Atenciosamente,
Sistema de Manutenção de Veículos
          `.trim(),
          metadata: {
            orcamentoId: updatedOrcamento.id,
            maintenanceId: updatedOrcamento.manutencao.id,
            oficinaId: updatedOrcamento.oficina.id,
            status: 'aprovado',
            valorTotal: valorTotal,
            dataAprovacao: new Date().toISOString(),
            emailType: 'orcamento_aprovado'
          }
        });

        console.log(`Email de aprovação enviado para oficina: ${updatedOrcamento.oficina.email}`);
      } catch (emailError) {
        console.error('Erro ao enviar email de aprovação:', emailError);
        // Não falhar a operação se o email falhar
      }
    }

    return res.ok(res.hateos_item(updatedOrcamento));
  } catch (error) {
     if (error.code === 'P2002' && error.meta?.target?.includes('manutencaoId')) {
      return res.status(409).json({ error: "Já existe um orçamento para esta manutenção." });
    }
    // P2025 é "Record to update not found", mas já verificamos a existência.
    // No entanto, pode acontecer em condições de corrida ou se a transação falhar por outro motivo.
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Operação falhou: Orçamento não encontrado." });
    }
    return next(error);
  }
};

export const remove = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Remove um orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              reciveNewBudget: { 
                type: "boolean", 
                description: "Se true, enviará novo link para criar orçamento" 
              },
              description: { 
                type: "string", 
                description: "Motivo da reprovação do orçamento" 
              }
            },
            required: ["description"]
          }
        }
      }
    }
    #swagger.responses[204] = { description: "Removido com sucesso" }
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);
    const { reciveNewBudget = false, description } = req.body;

    // Validar se a descrição foi fornecida
    if (!description || description.trim() === '') {
      return res.status(400).json({ error: "Descrição do motivo da reprovação é obrigatória." });
    }

    // Buscar o orçamento com todas as informações necessárias
    const orcamento = await prisma.orcamento.findUnique({
      where: { id },
      include: {
        manutencao: { 
          include: { 
            veiculo: true,
            oficina: true
          } 
        },
        oficina: true,
        produtos: { 
          include: { 
            produto: true 
          } 
        },
      },
    });

    if (!orcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }

    console.log("Removendo orçamento:", orcamento.id);

    // Executar todas as operações em uma única transação
    await prisma.$transaction(async (tx) => {
      // 1. Deletar os ProdutoOrcamento associados
      await tx.produtoOrcamento.deleteMany({
        where: { orcamentoId: id },
      });

      // 2. Deletar o orçamento
      await tx.orcamento.delete({
        where: { id },
      });

      // 3. Voltar status da manutenção para "aprovada" (aguardando novo orçamento)
      if (orcamento.manutencaoId) {
        await tx.manutencao.update({
          where: { id: orcamento.manutencaoId },
          data: { status: "aprovada" }
        });
      }
    });

    // 4. Enviar email de notificação sobre reprovação
    try {
      const manutencaoId = orcamento.manutencaoId;
      // Calcular valores do orçamento reprovado para referência
      const valorMaoObra = orcamento.valorMaoObra || 0;
      const valorProdutos = orcamento.produtos.reduce((total, produto) => {
        return total + (produto.valorUnitario * (produto.quantidade || 1));
      }, 0);
      const valorTotal = valorMaoObra + valorProdutos;

      // Gerar lista de produtos do orçamento reprovado
      const listaProdutos = orcamento.produtos.length > 0 
        ? orcamento.produtos.map(produto => 
            `• ${produto.produto.nome} - Qtd: ${produto.quantidade || 1} - R$ ${produto.valorUnitario.toFixed(2)}`
          ).join('\n        ')
        : '• Nenhum produto no orçamento';

      // Gerar novo link de orçamento se solicitado
      let novoOrcamentoLink = '';
      let linkExpiry = null;
      if (reciveNewBudget) {
        // Gerar token JWT com validade de 2 dias
        const tokenPayload = {
          manutencaoId: parseInt(orcamento.manutencaoId),
          oficinaId: orcamento.oficina.id,
          purpose: 'orcamento_manutencao'
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
              expiresIn: "1d",
            });
        
        // URL do frontend (pode vir de variável de ambiente)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const orcamentoLink = `${frontendUrl}/?manutencaoid=${manutencaoId}&oficinaid=${orcamento.oficina.id}&token=${token}`;
        novoOrcamentoLink = orcamentoLink
      }

      const emailSubject = reciveNewBudget 
        ? `❌ Orçamento REPROVADO - Novo Orçamento Solicitado - ${orcamento.manutencao.veiculo.placa}`
        : `❌ Orçamento REPROVADO - ${orcamento.manutencao.veiculo.placa}`;

      const emailBody = `
Prezados,

❌ **ORÇAMENTO REPROVADO**

Informamos que o orçamento enviado foi reprovado pela nossa equipe.

📋 **Detalhes do Orçamento Reprovado:**
- ID do Orçamento: #${orcamento.id}
- ID da Manutenção: #${orcamento.manutencao.id}
- Veículo: ${orcamento.manutencao.veiculo.marca} ${orcamento.manutencao.veiculo.modelo}
- Placa: ${orcamento.manutencao.veiculo.placa}
- Oficina: ${orcamento.oficina.nome}
- Data da Reprovação: ${new Date().toLocaleString('pt-BR')}

💰 **Valores do Orçamento Reprovado:**
- Mão de Obra: R$ ${valorMaoObra.toFixed(2)}
- Produtos: R$ ${valorProdutos.toFixed(2)}
- **Total: R$ ${valorTotal.toFixed(2)}**

🔧 **Produtos/Peças do Orçamento Reprovado:**
        ${listaProdutos}

📝 **Motivo da Reprovação:**
${description.trim()}

${reciveNewBudget ? `
🔗 **NOVO ORÇAMENTO SOLICITADO:**
Solicitamos que elaborem um novo orçamento considerando as observações acima.

**Link para Novo Orçamento:**
${novoOrcamentoLink}

⚠️ **Importante sobre o novo orçamento:**
- Este link é válido por **2 dias** (até ${linkExpiry?.toLocaleString('pt-BR')})
- Considerem as observações mencionadas no motivo da reprovação
- Elaborem um orçamento mais detalhado e adequado
- Justifiquem os valores e escolhas de produtos/serviços

📋 **Diretrizes para o Novo Orçamento:**
- Revise os preços de mão de obra
- Verifique se todos os produtos são necessários
- Considere alternativas mais econômicas se possível
- Detalhe melhor a descrição dos serviços
- Inclua justificativas para itens de alto valor
` : `
⏸️ **Próximos Passos:**
- Analisem o motivo da reprovação
- Entrem em contato conosco para esclarecimentos se necessário
- Aguardem novas instruções sobre como proceder

📞 **Contato:**
Para dúvidas sobre a reprovação ou esclarecimentos, entrem em contato com nossa equipe.
`}

Atenciosamente,
Sistema de Manutenção de Veículos
      `.trim();

      await publishEmail({
        to: orcamento.oficina.email,
        subject: emailSubject,
        body: emailBody,
        metadata: {
          orcamentoId: orcamento.id,
          maintenanceId: orcamento.manutencao.id,
          oficinaId: orcamento.oficina.id,
          status: 'reprovado',
          motivoReprovacao: description.trim(),
          valorTotalReprovado: valorTotal,
          dataReprovacao: new Date().toISOString(),
          novoOrcamentoSolicitado: reciveNewBudget,
          ...(reciveNewBudget && {
            novoOrcamentoLink: novoOrcamentoLink,
            linkExpiry: linkExpiry?.toISOString()
          }),
          emailType: 'orcamento_reprovado'
        }
      });

      console.log(`Email de reprovação enviado para oficina: ${orcamento.oficina.email}`);
      if (reciveNewBudget) {
        console.log(`Novo link de orçamento gerado: ${novoOrcamentoLink}`);
      }
    } catch (emailError) {
      console.error('Erro ao enviar email de reprovação:', emailError);
      // Não falhar a operação se o email falhar, mas registrar o erro
    }
    
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') { 
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    
    console.error("Erro ao remover orçamento:", error);
    return next(error);
  }
};

export const addProductToOrcamento = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Adiciona um produto a um orçamento existente"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['orcamentoId'] = {
      in: 'path',
      description: 'ID do Orçamento',
      required: true,
      type: 'integer'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              produtoId: { type: "integer" },
              valorUnitario: { type: "number" },
              fornecedor: { type: "string" }
            },
            required: ["produtoId", "valorUnitario", "fornecedor"]
          }
        }
      }
    }
    #swagger.responses[201] = { description: "Produto adicionado com sucesso" }
    #swagger.responses[404] = { description: "Orçamento ou Produto não encontrado" }
    #swagger.responses[409] = { description: "Este produto já existe no orçamento" }
  */
  try {
    const orcamentoId = parseInt(req.params.orcamentoId);
    const { produtoId, valorUnitario, fornecedor } = req.body;

    // Usar transação para garantir a integridade dos dados
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar se o orçamento e o produto existem
      const orcamento = await tx.orcamento.findUnique({ where: { id: orcamentoId } });
      if (!orcamento) {
        // Lançar um erro customizado para ser capturado no catch do transaction
        throw new Error('ORCAMENTO_NOT_FOUND');
      }

      const produto = await tx.produto.findUnique({ where: { id: produtoId } });
      if (!produto) {
        throw new Error('PRODUTO_NOT_FOUND');
      }
      
      // 2. Verificar se a combinação produto-orçamento já existe
      const existingEntry = await tx.produtoOrcamento.findFirst({
        where: {
          orcamentoId: orcamentoId,
          produtoId: produtoId,
        },
      });

      if (existingEntry) {
        throw new Error('PRODUCT_ALREADY_IN_ORCAMENTO');
      }

      // 3. Criar a nova entrada em ProdutoOrcamento
      const newProdutoOrcamento = await tx.produtoOrcamento.create({
        data: {
          orcamentoId,
          produtoId,
          valorUnitario,
          fornecedor,
        },
        include: {
            produto: true // Incluir dados do produto na resposta
        }
      });

      return newProdutoOrcamento;
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'ORCAMENTO_NOT_FOUND') {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    if (error.message === 'PRODUTO_NOT_FOUND') {
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    if (error.message === 'PRODUCT_ALREADY_IN_ORCAMENTO') {
        return res.status(409).json({ error: "Este produto já consta no orçamento." });
    }
    return next(error);
  }
};

export const removeProductFromOrcamento = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Remove um produto de um orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['orcamentoId'] = {
      in: 'path',
      description: 'ID do Orçamento',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['produtoId'] = {
      in: 'path',
      description: 'ID do Produto a ser removido',
      required: true,
      type: 'integer'
    }
    #swagger.responses[204] = { description: "Produto removido com sucesso" }
    #swagger.responses[404] = { description: "Associação Produto-Orçamento não encontrada" }
  */
  try {
    const orcamentoId = parseInt(req.params.orcamentoId);
    const produtoId = parseInt(req.params.produtoId);

    // Para deletar, precisamos do ID da tabela ProdutoOrcamento.
    // Primeiro, encontramos a entrada específica.
    const produtoOrcamentoEntry = await prisma.produtoOrcamento.findFirst({
        where: {
            orcamentoId: orcamentoId,
            produtoId: produtoId
        }
    });

    if (!produtoOrcamentoEntry) {
        return res.status(404).json({ error: "Produto não encontrado neste orçamento." });
    }

    // Agora deletamos usando o ID único da entrada.
    await prisma.produtoOrcamento.delete({
        where: {
            id: produtoOrcamentoEntry.id
        }
    });

    return res.no_content(); // Retorna 204 No Content
  } catch (error) {
    // Tratamento de erro caso o ID não seja um número válido, por exemplo.
    if (error instanceof TypeError || error instanceof ReferenceError) {
        return res.status(400).json({ error: "Parâmetros inválidos." });
    }
    return next(error);
  }
};