use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::time::Duration;

const LDXP_BASE_URL: &str = "https://wzyp.cn";
const LDXP_SHOP_TOKEN: &str = "CodexTool";
const LDXP_SHOP_URL: &str = "https://wzyp.cn/shop/CodexTool";
const GOODS_TYPES: [&str; 4] = ["card", "article", "resource", "equity"];

#[derive(Clone, Serialize)]
struct LdxpStorefront {
    name: String,
    avatar: String,
    description: String,
    region: String,
    goods_count: u64,
    sell_count: u64,
    shop_url: &'static str,
}

#[derive(Clone, Serialize)]
struct LdxpCategory {
    id: String,
    name: String,
    image: String,
    goods_type: String,
    goods_count: u64,
}

#[derive(Clone, Serialize)]
struct LdxpGoods {
    goods_key: String,
    goods_type: String,
    name: String,
    description: String,
    image: String,
    price: f64,
    market_price: Option<f64>,
    stock: Option<u64>,
    in_stock: bool,
    category_id: String,
    category_name: String,
    purchase_url: String,
}

#[derive(Serialize)]
struct LdxpCatalog {
    provider: &'static str,
    storefront: LdxpStorefront,
    categories: Vec<LdxpCategory>,
    goods: Vec<LdxpGoods>,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36")
        .build()
        .map_err(|error| format!("初始化链动小铺网络客户端失败: {error}"))
}

async fn shop_request(
    client: &reqwest::Client,
    endpoint: &str,
    body: Value,
) -> Result<Value, String> {
    let response = client
        .post(format!("{LDXP_BASE_URL}{endpoint}"))
        .header("accept", "application/json, text/plain, */*")
        .header("accept-language", "zh-CN,zh;q=0.9,en;q=0.8")
        .header("origin", LDXP_BASE_URL)
        .header("referer", LDXP_SHOP_URL)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("连接链动小铺失败: {error}"))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let text = response
        .text()
        .await
        .map_err(|error| format!("读取链动小铺响应失败: {error}"))?;

    let trimmed = text.trim_start().to_ascii_lowercase();
    if content_type.contains("text/html")
        || trimmed.starts_with("<html")
        || trimmed.starts_with("<!doctype html")
        || text.contains("var arg1")
    {
        return Err(
            "链动小铺正在进行安全验证，请稍后重试或在浏览器打开店铺；CodexTool 官方货源不受影响。"
                .to_string(),
        );
    }
    if !status.is_success() {
        return Err(format!("链动小铺请求失败（HTTP {}）。", status.as_u16()));
    }

    let payload = serde_json::from_str::<Value>(&text)
        .map_err(|error| format!("链动小铺返回了无法解析的数据: {error}"))?;
    if payload.get("code").and_then(Value::as_i64) != Some(1) {
        let message = payload
            .get("msg")
            .and_then(Value::as_str)
            .unwrap_or("未知错误");
        return Err(format!("链动小铺：{message}"));
    }
    Ok(payload.get("data").cloned().unwrap_or(Value::Null))
}

fn number(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::Number(value)) => value.as_f64(),
        Some(Value::String(value)) => value.parse::<f64>().ok(),
        _ => None,
    }
}

fn unsigned(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(value)) => value.as_u64(),
        Some(Value::String(value)) => value.parse::<u64>().ok(),
        _ => None,
    }
}

fn text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(value)) => value.trim().to_string(),
        Some(Value::Number(value)) => value.to_string(),
        _ => String::new(),
    }
}

fn strip_html(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut inside_tag = false;
    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                output.push(' ');
            }
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }
    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn valid_key(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn safe_purchase_url(product: &Value, goods_key: &str) -> String {
    let returned = text(product.get("link"));
    let expected_prefix = format!("{LDXP_BASE_URL}/item/");
    if returned.starts_with(&expected_prefix)
        && returned[expected_prefix.len()..].split(['?', '#']).next() == Some(goods_key)
    {
        returned
    } else {
        format!("{expected_prefix}{goods_key}")
    }
}

fn normalize_product(product: &Value, fallback_type: &str) -> Option<LdxpGoods> {
    let goods_key = text(product.get("goods_key"));
    if !valid_key(&goods_key) {
        return None;
    }
    let stock = unsigned(product.pointer("/extend/stock_count"));
    Some(LdxpGoods {
        goods_key: goods_key.clone(),
        goods_type: {
            let value = text(product.get("goods_type"));
            if value.is_empty() {
                fallback_type.to_string()
            } else {
                value
            }
        },
        name: {
            let value = text(product.get("name"));
            if value.is_empty() {
                "未命名商品".to_string()
            } else {
                value
            }
        },
        description: strip_html(&text(product.get("description"))),
        image: text(product.get("image")),
        price: number(product.get("price")).unwrap_or_default(),
        market_price: number(product.get("market_price")).filter(|value| *value > 0.0),
        stock,
        in_stock: stock.map(|value| value > 0).unwrap_or(true),
        category_id: text(product.pointer("/category/id")),
        category_name: text(product.pointer("/category/name")),
        purchase_url: safe_purchase_url(product, &goods_key),
    })
}

async fn goods_by_type(client: &reqwest::Client, goods_type: &str) -> Result<Vec<Value>, String> {
    let mut all_goods = Vec::new();
    for current in 1..=5 {
        let data = shop_request(
            client,
            "/shopApi/Shop/goodsList",
            json!({
                "token": LDXP_SHOP_TOKEN,
                "keywords": "",
                "category_id": 0,
                "goods_type": goods_type,
                "current": current,
                "pageSize": 100
            }),
        )
        .await?;
        let page = data
            .get("list")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let total = unsigned(data.get("total")).unwrap_or_default() as usize;
        let page_len = page.len();
        all_goods.extend(page);
        if page_len == 0 || page_len < 100 || all_goods.len() >= total {
            break;
        }
        tokio::time::sleep(Duration::from_millis(850)).await;
    }
    Ok(all_goods)
}

#[tauri::command]
pub(crate) async fn get_ldxp_store_catalog() -> Result<Value, String> {
    let client = client()?;
    let info = shop_request(
        &client,
        "/shopApi/Shop/info",
        json!({ "token": LDXP_SHOP_TOKEN }),
    )
    .await?;

    let configured_types = info
        .get("goods_type_sort")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .filter(|value| GOODS_TYPES.contains(value))
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .filter(|values| !values.is_empty())
        .unwrap_or_else(|| {
            GOODS_TYPES
                .iter()
                .map(|value| (*value).to_string())
                .collect()
        });

    let mut products = Vec::new();
    let mut categories = BTreeMap::<String, LdxpCategory>::new();
    for goods_type in configured_types {
        let count_key = format!("{goods_type}_count");
        if unsigned(info.get(count_key.as_str())) == Some(0) {
            continue;
        }
        tokio::time::sleep(Duration::from_millis(850)).await;
        for raw_product in goods_by_type(&client, &goods_type).await? {
            let Some(product) = normalize_product(&raw_product, &goods_type) else {
                continue;
            };
            if !product.category_id.is_empty() || !product.category_name.is_empty() {
                let key = format!("{}:{}", product.goods_type, product.category_id);
                categories.entry(key).or_insert_with(|| LdxpCategory {
                    id: product.category_id.clone(),
                    name: product.category_name.clone(),
                    image: text(raw_product.pointer("/category/image")),
                    goods_type: product.goods_type.clone(),
                    goods_count: unsigned(raw_product.pointer("/category/goods_count"))
                        .unwrap_or_default(),
                });
            }
            products.push(product);
        }
    }

    products.sort_by(|left, right| {
        right
            .in_stock
            .cmp(&left.in_stock)
            .then_with(|| left.price.total_cmp(&right.price))
    });
    let catalog = LdxpCatalog {
        provider: "ldxp",
        storefront: LdxpStorefront {
            name: {
                let value = text(info.get("nickname"));
                if value.is_empty() {
                    "CodexTool".to_string()
                } else {
                    value
                }
            },
            avatar: text(info.get("avatar")),
            description: strip_html(&text(info.get("description"))),
            region: text(info.get("login_province")),
            goods_count: unsigned(info.get("goods_count")).unwrap_or(products.len() as u64),
            sell_count: unsigned(info.get("sell_count")).unwrap_or_default(),
            shop_url: LDXP_SHOP_URL,
        },
        categories: categories.into_values().collect(),
        goods: products,
    };
    serde_json::to_value(catalog).map_err(|error| format!("整理链动小铺目录失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{normalize_product, safe_purchase_url, strip_html, valid_key};
    use serde_json::json;

    #[test]
    fn normalizes_ldxp_product_without_changing_source_fields() {
        let value = json!({
            "goods_key": "abc_123",
            "goods_type": "card",
            "name": "测试商品",
            "price": "12.50",
            "description": "<p>自动&nbsp;发货</p>",
            "link": "https://wzyp.cn/item/abc_123",
            "category": { "id": 20, "name": "Codex 成品" },
            "extend": { "stock_count": 3 }
        });
        let product = normalize_product(&value, "card").unwrap();
        assert_eq!(product.goods_key, "abc_123");
        assert_eq!(product.category_id, "20");
        assert_eq!(product.price, 12.5);
        assert!(product.in_stock);
        assert_eq!(product.description, "自动 发货");
    }

    #[test]
    fn rejects_unsafe_product_links_and_keys() {
        let value = json!({ "link": "https://example.com/item/abc" });
        assert_eq!(safe_purchase_url(&value, "abc"), "https://wzyp.cn/item/abc");
        assert!(valid_key("abc-123_X"));
        assert!(!valid_key("../abc"));
    }

    #[test]
    fn strips_markup_for_native_cards() {
        assert_eq!(strip_html("<p>Hello</p><p>Codex</p>"), "Hello Codex");
    }
}
