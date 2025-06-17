export default (req, res, next) => {
  res.hateos_item = (data) => {
    return {
      ...data,
      _links: [
        { rel: "self", href: req.originalUrl, method: req.method },
        { rel: "list", href: req.baseUrl, method: "GET" },
        { rel: "update", href: `${req.baseUrl}/${req.params.id}`, method: "PUT" },
        { rel: "delete", href: `${req.baseUrl}/${req.params.id}`, method: "DELETE" },
      ],
    }
  }

  res.hateos_list = (name, data, totalPages) => {
    const page = parseInt(req.query._page) || 1;
    const order = req.query._order || null;
    const sort = req.query._sort || null;

    return {
      [name]: data.map((item) => ({
        ...item,
        _links: [
          { rel: "self", href: `${req.baseUrl}/${item.id}`, method: "GET" },
        ],
      })),
      _page: {
        current: page,
        total: totalPages,
        size: data.length,
        order: order,
        sort: sort
      },
      _links: [
        { rel: "self", href: req.baseUrl, method: "GET" },
        { rel: "create", href: req.baseUrl, method: "POST" },
        { rel: "previous", href: page > 1 ? `${req.baseurl}?_page=${page - 1}` : null, method: "GET" },
        { rel: "next", href: page < totalPages ? `${req.baseurl}?_page=${page + 1}` : null, method: "GET" },
      ],
    }
  }

  next();
}
