import amqp from 'amqplib';
import dotenv from 'dotenv';
import colors from 'colors';
import connection from './services/connection.js';
import sgMail from '@sendgrid/mail'

dotenv.config();

const emailQueue = 'emailQueue';
const exchange = 'emailExchange';

const processEmail = async (emailMessage) => {
    try {
        console.log(colors.cyan('\n=== 📧 NOVA MENSAGEM DE EMAIL RECEBIDA ==='));
        console.log(colors.blue('🔍 Dados completos da mensagem:'));
        console.log(JSON.stringify(emailMessage, null, 2));
        
        console.log(colors.yellow('\n📋 INFORMAÇÕES PRINCIPAIS:'));
        console.log(`${colors.white('• Event Type:')} ${colors.green(emailMessage.eventType)}`);
        console.log(`${colors.white('• Producer:')} ${colors.green(emailMessage.producer)}`);
        console.log(`${colors.white('• Version:')} ${colors.green(emailMessage.version)}`);
        console.log(`${colors.white('• Timestamp:')} ${colors.green(emailMessage.timestamp)}`);
        console.log(`${colors.white('• Correlation ID:')} ${colors.green(emailMessage.correlationId)}`);
        console.log(`${colors.white('• Priority:')} ${colors.green(emailMessage.priority)}`);
        console.log(`${colors.white('• Max Retries:')} ${colors.green(emailMessage.maxRetries)}`);
        console.log(`${colors.white('• Retry Count:')} ${colors.green(emailMessage.retryCount)}`);

        if (emailMessage.data) {
            // Processar o campo 'to' para múltiplos destinatários
            let recipients = emailMessage.data.to;
            
            // Se for string, transformar em array
            if (typeof recipients === 'string') {
                recipients = recipients.split(',').map(email => email.trim());
            }
            
            // Garantir que é um array
            if (!Array.isArray(recipients)) {
                recipients = [recipients];
            }

            console.log(colors.yellow('\n📧 DADOS DO EMAIL:'));
            console.log(`${colors.white('• Para:')} ${colors.cyan(recipients.join(', '))}`);
            console.log(`${colors.white('• Quantidade de destinatários:')} ${colors.green(recipients.length)}`);
            console.log(`${colors.white('• Assunto:')} ${colors.cyan(emailMessage.data.subject)}`);
            console.log(`${colors.white('• De:')} ${colors.cyan(emailMessage.data.from || 'Não informado')}`);
            console.log(`${colors.white('• Reply To:')} ${colors.cyan(emailMessage.data.replyTo || 'Não informado')}`);
            console.log(`${colors.white('• Template:')} ${colors.cyan(emailMessage.data.template || 'Não informado')}`);
            console.log(`${colors.white('• Anexos:')} ${colors.cyan(emailMessage.data.attachments?.length || 0)} arquivo(s)`);
            
            if (emailMessage.data.body) {
                console.log(colors.yellow('\n📝 CORPO DO EMAIL:'));
                console.log(colors.gray('─'.repeat(50)));
                console.log(colors.white(emailMessage.data.body));
                console.log(colors.gray('─'.repeat(50)));
            }

            if (emailMessage.data.metadata && Object.keys(emailMessage.data.metadata).length > 0) {
                console.log(colors.yellow('\n📊 METADATA:'));
                Object.entries(emailMessage.data.metadata).forEach(([key, value]) => {
                    console.log(`${colors.white('  •')} ${colors.cyan(key)}: ${colors.green(value)}`);
                });
            }
          
            // Configurar SendGrid
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            
            // Preparar a mensagem para múltiplos destinatários
            const msg = {
                to: recipients, // Array de emails
                from: emailMessage.data.from || 'ritzelarthur@gmail.com', // Usar o from da mensagem ou padrão
                subject: emailMessage.data.subject,
                text: emailMessage.data.body,
            };

            // Se tiver HTML, incluir
            if (emailMessage.data.html) {
                msg.html = emailMessage.data.html;
            }

            // Se tiver anexos, incluir
            if (emailMessage.data.attachments && emailMessage.data.attachments.length > 0) {
                msg.attachments = emailMessage.data.attachments;
            }

            console.log(colors.yellow(`\n📤 Enviando email para ${recipients.length} destinatário(s)...`));
            
            // Enviar o email
            var response = await sgMail.send(msg);
            console.log(colors.green(`✅ Email enviado com sucesso para: ${recipients.join(', ')}`));
        }

        console.log(colors.green('\n✅ Email processado com sucesso!'));
        console.log(colors.gray('═'.repeat(60)));
        
        return true;
        
    } catch (error) {
        console.error(colors.red('\n❌ ERRO AO PROCESSAR EMAIL:'));
        console.error(`${colors.white('• Mensagem:')} ${colors.red(error.message)}`);
        
        // Log específico para erros do SendGrid
        if (error.response && error.response.body) {
            console.error(`${colors.white('• SendGrid Error:')} ${colors.red(JSON.stringify(error.response.body, null, 2))}`);
        }
        
        console.error(`${colors.white('• Stack:')} ${colors.red(error.stack)}`);
        console.log(colors.gray('═'.repeat(60)));
        
        // Re-lança o erro para o sistema de retry do connection.js
        throw error;
    }
};

// Conectando e consumindo a fila de emails
console.log(colors.rainbow('🚀 Iniciando consumer de emails...'));
console.log(`${colors.white('📡 Exchange:')} ${colors.cyan(exchange)}`);
console.log(`${colors.white('📮 Queue:')} ${colors.cyan(emailQueue)}`);
console.log(`${colors.white('🔄 Max Retries:')} ${colors.cyan(process.env.MAX_RETRIES)}`);
console.log(colors.yellow('⏳ Aguardando mensagens...\n'));

// Usando seu connection.js existente
connection(emailQueue, exchange, emailQueue, processEmail);