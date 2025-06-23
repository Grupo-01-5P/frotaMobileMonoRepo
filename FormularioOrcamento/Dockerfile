# Usar imagem oficial do Node.js
FROM node

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências incluindo o serve
RUN npm ci && npm install -g serve

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Expor porta 3000
EXPOSE 3000

# Comando para servir a aplicação
CMD ["serve", "-s", "dist", "-l", "3000"]