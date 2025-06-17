import amqp from 'amqplib';
import { v4 } from 'uuid';

const exchange = 'emailExchange';
const routingKey = 'emailQueue';

export default async (emailData) => {
    let connection;
    try {
        connection = await amqp.connect(process.env.RABBIT_MQ);
        const channel = await connection.createChannel();

        await channel.assertExchange(exchange, 'direct', { durable: true });

        const message = {
            eventType: 'email_notification',
            version: "1.0",
            producer: "email-service",
            timestamp: new Date(),
            correlationId: v4(),
            priority: emailData.priority || 'normal',
            retryCount: 0,
            maxRetries: emailData.maxRetries || 3,
            data: {
                to: emailData.to,
                subject: emailData.subject,
                body: emailData.body,
                html: emailData.html, // para emails HTML
                template: emailData.template, // template ID se usar templates
                variables: emailData.variables, // variáveis para o template
                from: emailData.from, // remetente personalizado
                replyTo: emailData.replyTo,
                attachments: emailData.attachments || [],
                metadata: emailData.metadata || {}
            }
        };

        const messageOptions = {
            persistent: true,
            priority: getPriorityValue(emailData.priority),
            messageId: message.correlationId,
            timestamp: Date.now(),
            headers: {
                'email-type': emailData.template || 'custom',
                'recipient': emailData.to
            }
        };

        const success = channel.publish(
            exchange, 
            routingKey, 
            Buffer.from(JSON.stringify(message)),
            messageOptions
        );

        if (!success) {
            throw new Error('Failed to publish email to queue');
        }

        console.log(`Email notification published to: ${emailData.to}`);
        
        await channel.close();
        
        return {
            success: true,
            correlationId: message.correlationId,
            recipient: emailData.to
        };

    } catch (error) {
        console.error(`Error publishing email notification: ${error.message}`);
        throw new Error(`Error publishing email notification: ${error.message}`);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
};

// Função auxiliar para converter prioridade em valor numérico
function getPriorityValue(priority) {
    const priorities = {
        'low': 1,
        'normal': 5,
        'high': 8,
        'urgent': 10
    };
    return priorities[priority] || 5;
}