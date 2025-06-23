import amqp from 'amqplib';
import colors from 'colors';



export default async (queue, exchange, routingKey, callback) => {
    const RABBIT_MQ = process.env.RABBIT_MQ;
    const MAX_RETRIES = parseInt(process.env.MAX_RETRIES);
    try {
        const connection = await amqp.connect(RABBIT_MQ);
        const channel = await connection.createChannel();

        process.once("SIGINT", async () => {
                console.log("Closing connection...");
                await channel.close();
                await connection.close();
            }
        );

        await channel.assertQueue(queue, { durable: true });

        await channel.assertQueue(`${queue}_dlq`, { durable: true });

        await channel.bindQueue(
            queue,
            exchange,
            routingKey
        );

        await channel.bindQueue(
            `${queue}_dlq`,
            exchange,
            "dlq"
        );

        await channel.consume(
            queue, 
            (menssage) => {
                const content = menssage.content.toString();
                const retries = menssage.properties.headers['x-retries'] || 0;
                try {
                    console.log(colors.green('==> Mensagem recebida'), content);
                    console.log(colors.green('==> Quantidade de tentativas'), retries);

                    // forçando um erro para teste
                    // throw new Error("Erro ao processar a mensagem!");

                    callback(JSON.parse(content));
                    console.log(colors.green('==> Mensagem processada'));
                } catch (error) {
                    if(retries < MAX_RETRIES) {
                        console.log(colors.yellow('==> Reenviando mensagem para a fila'));
                        channel.sendToQueue(
                            queue,
                            Buffer.from(content),
                            {
                                headers: {
                                    'x-retries': retries + 1,
                                },
                                persistent: true,
                            }
                        );

                    }else{
                        console.log(colors.red("==> Enviando mensagem para a fila de DLQ"));
                        channel.publish(
                            exchange,
                            "dlq",
                            Buffer.from(content),
                            {
                                headers: {
                                    'x-retries': retries,
                                },
                                persistent: true,
                            }
                        );
                    }
                    
                }finally {
                    channel.ack(menssage);
                }
            }, 
            { noAck: false }
    );
    } catch (error) {
        console.error('Error in consumer:', error);
    }
}