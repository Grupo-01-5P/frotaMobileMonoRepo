import httpStatus from 'http-status';

export default (err, req, res, next) => {
    const { code, message } = err;

    if(message){
        console.log(message);
    }

    res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json({
            code,
            message,
        });

  }