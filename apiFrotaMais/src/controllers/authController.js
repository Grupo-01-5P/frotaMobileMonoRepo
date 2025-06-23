import jsonwebtoken from "jsonwebtoken";
import prisma from "../config/database.js";

export const generate = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.unauthorized();
    }

    const payload = {
      id: user.id,
      email: user.email,
      funcao: user.funcao,
    };

    const JWTSECRET = process.env.JWT_SECRET;

    const token = jsonwebtoken.sign(payload, JWTSECRET, {
      expiresIn: "12h",
    });

    return res.ok({ token });
  } catch (error) {
    return next(error);
  }
};

export const verify = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    const JWTSECRET = process.env.JWT_SECRET;
    try {
      const payload = jsonwebtoken.verify(token, JWTSECRET);
      req.payload = payload;
      return next();
    } catch (err) {
      return res.unauthorized();
    }
  }

  return res.unauthorized();
};
