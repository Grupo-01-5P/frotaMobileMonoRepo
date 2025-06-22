import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    version: "1.0.0",
    title: "Tecnologias Emergentes",
    description: "Documentação da API criada em sala"
  },
  servers: [
    {
      url: "http://localhost:4040",
    }
  ],
  components: {
    schemas: {
      InternalServerError: {
        code: "",
        message: "",
      },
      User: {
        nome: { type: "string" },
        email: { type: "string", format: "email" },
        login: { type: "string" },
        senha: { type: "string" },
        funcao: { type: "string", enum: ["supervisor", "analista"] }
      },
      Vehicle: {
        placa: { type: "string" },
        marca: { type: "string" },
        modelo: { type: "string" },
        anoFabricacao: { type: "integer" },
        anoModelo: { type: "integer" },
        cor: { type: "string" },
        renavam: { type: "string" },
        chassi: { type: "string" },
        empresa: { type: "string" },
        departamento: { type: "string" },
        tipoVeiculo: { type: "string", enum: ["carro", "moto", "caminhão", "ônibus", "van"] },
        supervisorId: { type: "integer" }
      },
      Product: {
        id: { type: "integer" },
        nome: { type: "string" },
        descricao: { type: "string" },
        precoMedio: { type: "number", format: "float" }
      }
    },
    securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Insira o token JWT"
        }
      },
      security: [
        {
          BearerAuth: []
        }
      ]
  }
};

const outputFile = "./config/swagger.json";
const endpointsFiles = ["./routes.js"];

swaggerAutogen({ openapi: "3.0.0" })(outputFile, endpointsFiles, doc)
  .then(async () => {
    await import("./server.js");
});
