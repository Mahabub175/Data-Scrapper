const express = require("express");
const axios = require("axios");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/:category", async (req, res) => {
  let category = req.params.category;

  const isNumber = !isNaN(category);

  const isString = /^[a-zA-Z]+$/.test(category);

  if (isString) {
    category = category.toLowerCase().replace(/[\s-]+/g, "_");
  }
  const baseUrl = `https://api.arogga.com/general/v3/search/?_perPage=1000&_is_base=1&_haveImage=1&_product_category_id=${category}&_order=pv_allow_sales%3Adesc%2CproductCountOrdered%3Adesc&_get_filters=true&f=web&b=Chrome&v=131.0.0.0&os=Windows&osv=10`;

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
          category: product.p_type.toLowerCase().replace(/[\s_]+/g, " ") || "",
          ...(product?.p_brand && { brand: product.p_brand }),
          ...(product?.p_generic_name && { generic: product.p_generic_name }),
          ...(product?.p_strength &&
            (() => {
              const [firstPart] = product.p_strength.split("+");
              return {
                weight: Number(firstPart.replace(/[^\d.]/g, "")),
                unit: firstPart.replace(/[\d.\s]/g, "").trim(),
              };
            })()),
          sellingPrice: Number(mrp),
          discountPercent: Number(discountPercent),
          stockStatus: Number(5),
          offerPrice: Number(offerPrice.toFixed(2)),
          image:
            image ||
            "https://thumbs.dreamstime.com/b/demo-demo-icon-139882881.jpg",
          description: product.p_description || "",
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
      category: isNumber
        ? allProducts[0]?.category.toLowerCase().replace(/[\s_]+/g, " ")
        : category,
      data: allProducts,
    });
  } catch (error) {
    console.error("Error fetching the API data:", error);
    res.status(500).send("Error occurred while fetching the API data.");
  }
});

app.get("/scrape/:category", async (req, res) => {
  let category = req.params.category;

  if (category) {
    category = category.toLowerCase().replace(/[\s&,]+/g, "-");
  }
  const url = `https://chaldal.com/${category}`;

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "load", timeout: 0 });

    const products = await page.evaluate(() => {
      const productElements = document.querySelectorAll(".product");
      return Array.from(productElements).map((product) => {
        const name = product.querySelector(".name")?.textContent.trim() || null;
        const subText =
          product.querySelector(".subText")?.textContent.trim() || null;
        const price =
          product
            .querySelector(".price span:nth-child(2)")
            ?.textContent.trim()
            .replace(/,/g, "") || null;
        const discountedPrice =
          product
            .querySelector(".discountedPrice span:nth-child(2)")
            ?.textContent.trim()
            .replace(/,/g, "") || null;
        const image = product
          .querySelector(".imageWrapper img")
          ?.getAttribute("src");

        return {
          name,
          subText,
          price: price ? parseFloat(price) : null,
          ...(discountedPrice && {
            discountedPrice: parseFloat(discountedPrice),
          }),
          image,
        };
      });
    });

    await browser.close();

    res.status(200).json({
      success: true,
      totalData: products.length,
      category: category,
      data: products,
    });
  } catch (error) {
    console.error("Error scraping data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
