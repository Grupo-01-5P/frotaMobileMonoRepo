import httpStatus from 'http-status';

export default (req, res, next) => {
  res
  .status(httpStatus.NOT_FOUND)
  .send("Not Found");
}