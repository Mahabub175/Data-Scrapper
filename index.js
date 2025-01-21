const express = require("express");
const axios = require("axios");

const app = express();

app.get("/:category?", async (req, res) => {
  let category = req.params.category;

  if (category) {
    category = category.toLowerCase().replace(/[\s-]+/g, "_");
  }
  const baseUrl = `https://api.arogga.com/general/v3/search/?_perPage=16&_is_base=1&_haveImage=1&_product_type=${category}&_order=pv_allow_sales%3Adesc%2CproductCountOrdered%3Adesc&_get_filters=true&f=web&b=Chrome&v=131.0.0.0&os=Windows&osv=10`;

  try {
    let allProducts = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const url = `${baseUrl}&_page=${currentPage}`;
      const response = await axios.get(url);

      const products = response.data.data.map((product) => {
        const pvData = product.pv[0];
        const image = product.attachedFiles_p_images?.[0]?.src || "";
        const mrp = pvData.pv_mrp || 0;
        const discountPercent = pvData.pv_b2c_discount_percent || 0;

        const offerPrice = mrp - (mrp * discountPercent) / 100;

        return {
          name: product.p_name || "",
          category: product.p_type || "",
          description: product.p_description || "",
          brand: product.p_brand || "",
          sellingPrice: mrp,
          b2cPrice: pvData.pv_b2c_discounted_price || 0,
          b2bPrice: pvData.pv_b2b_discounted_price || 0,
          discountPercent: discountPercent,
          stockStatus:
            pvData.pv_stock_status === 1 ? "In Stock" : "Out of Stock",
          mainImage: image,
          offerPrice: Number(offerPrice.toFixed(2)),
        };
      });

      allProducts = [...allProducts, ...products];

      totalPages =
        response.data.totalPages || Math.ceil(response.data.total / 16);

      currentPage++;
    } while (currentPage <= totalPages);
    res.json({
      success: true,
      totalData: allProducts.length,
      category: category,
      data: allProducts,
    });
  } catch (error) {
    console.error("Error fetching the API data:", error);
    res.status(500).send("Error occurred while fetching the API data.");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
