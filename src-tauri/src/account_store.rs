use serde_json::{Map, Value};

const SHOP_API: &str = "https://www.16688.com.cn/shopApi";
const SHOP_ALIAS: &str = "CODEXTOOL";

async fn shop_request(endpoint: &str, business: Map<String, Value>) -> Result<Value, String> {
    let url = format!("{SHOP_API}{endpoint}");
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("初始化账号商城网络客户端失败: {error}"))?
        .post(url)
        .json(&business)
        .send()
        .await
        .map_err(|error| format!("连接账号商城失败: {error}"))?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("账号商城返回了无法解析的数据: {error}"))?;
    if !status.is_success() {
        return Err(format!("账号商城请求失败（HTTP {}）。", status.as_u16()));
    }
    if payload.get("code").and_then(Value::as_i64) != Some(1) {
        let message = payload
            .get("msg")
            .and_then(Value::as_str)
            .unwrap_or("未知错误");
        return Err(format!("账号商城：{message}"));
    }
    Ok(payload.get("data").cloned().unwrap_or(Value::Null))
}

async fn storefront() -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(SHOP_ALIAS.to_string()));
    shop_request("/shop/detail", params).await
}

async fn resolved_shop_no() -> Result<String, String> {
    storefront()
        .await?
        .get("shop_no")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| "账号商城未返回有效店铺编号。".to_string())
}

fn validated_goods_no(goods_no: String) -> Result<String, String> {
    let goods_no = goods_no.trim();
    if goods_no.is_empty() || goods_no.len() > 64 {
        return Err("商品编号无效。".to_string());
    }
    Ok(goods_no.to_string())
}

fn validated_email(contact_email: String) -> Result<String, String> {
    let email = contact_email.trim();
    let mut parts = email.split('@');
    let local = parts.next().unwrap_or_default();
    let domain = parts.next().unwrap_or_default();
    if email.len() > 254
        || email.chars().any(char::is_whitespace)
        || local.is_empty()
        || domain.is_empty()
        || parts.next().is_some()
        || !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
    {
        return Err("请填写有效的联系邮箱。".to_string());
    }
    Ok(email.to_string())
}

#[tauri::command]
pub(crate) async fn get_account_storefront() -> Result<Value, String> {
    storefront().await
}

#[tauri::command]
pub(crate) async fn list_account_store_categories() -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(resolved_shop_no().await?));
    shop_request("/goodsCategory/list", params).await
}

#[tauri::command]
pub(crate) async fn list_account_store_goods(
    page_no: Option<u32>,
    page_size: Option<u32>,
    keywords: Option<String>,
    goods_category_no: Option<String>,
) -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(SHOP_ALIAS.to_string()));
    params.insert("page_no".into(), Value::from(page_no.unwrap_or(1).max(1)));
    params.insert(
        "page_size".into(),
        Value::from(page_size.unwrap_or(48).clamp(1, 100)),
    );
    let keywords = keywords.unwrap_or_default().trim().to_string();
    if !keywords.is_empty() {
        params.insert("keywords".into(), Value::String(keywords));
    }
    let goods_category_no = goods_category_no.unwrap_or_default().trim().to_string();
    if !goods_category_no.is_empty() {
        params.insert("goods_category_no".into(), Value::String(goods_category_no));
    }
    shop_request("/goods/list", params).await
}

#[tauri::command]
pub(crate) async fn list_account_store_payment_methods() -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(resolved_shop_no().await?));
    shop_request("/payment/list", params).await
}

#[tauri::command]
pub(crate) async fn quote_account_store_order(
    goods_no: String,
    quantity: Option<u32>,
    channel_id: u32,
    coupon_code: Option<String>,
) -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(resolved_shop_no().await?));
    params.insert(
        "goods_no".into(),
        Value::String(validated_goods_no(goods_no)?),
    );
    params.insert(
        "quantity".into(),
        Value::from(quantity.unwrap_or(1).clamp(1, 100)),
    );
    params.insert("channel_id".into(), Value::from(channel_id));
    params.insert(
        "coupon_code".into(),
        Value::String(coupon_code.unwrap_or_default().trim().to_string()),
    );
    shop_request("/payment/quotePrice", params).await
}

#[tauri::command]
pub(crate) async fn create_account_store_order(
    goods_no: String,
    quantity: Option<u32>,
    channel_id: u32,
    contact_email: String,
    coupon_code: Option<String>,
) -> Result<Value, String> {
    let mut params = Map::new();
    params.insert("shop_no".into(), Value::String(resolved_shop_no().await?));
    params.insert(
        "goods_no".into(),
        Value::String(validated_goods_no(goods_no)?),
    );
    params.insert(
        "quantity".into(),
        Value::from(quantity.unwrap_or(1).clamp(1, 100)),
    );
    params.insert("channel_id".into(), Value::from(channel_id));
    params.insert(
        "contact_email".into(),
        Value::String(validated_email(contact_email)?),
    );
    params.insert(
        "coupon_code".into(),
        Value::String(coupon_code.unwrap_or_default().trim().to_string()),
    );
    let result = shop_request("/order/create", params).await?;
    if let Some(pay_url) = result.get("pay_url").and_then(Value::as_str) {
        if !pay_url.starts_with("https://") {
            return Err("账号商城返回了不安全的支付地址。".to_string());
        }
    }
    Ok(result)
}

#[tauri::command]
pub(crate) async fn get_account_store_order_status(trade_no: String) -> Result<Value, String> {
    let trade_no = trade_no.trim();
    if trade_no.is_empty() || trade_no.len() > 128 {
        return Err("订单编号无效。".to_string());
    }
    let mut params = Map::new();
    params.insert("trade_no".into(), Value::String(trade_no.to_string()));
    shop_request("/order/status", params).await
}

#[cfg(test)]
mod tests {
    use super::{validated_email, validated_goods_no};

    #[test]
    fn rejects_empty_goods_number() {
        assert!(validated_goods_no("  ".to_string()).is_err());
    }

    #[test]
    fn trims_valid_goods_number() {
        assert_eq!(validated_goods_no(" G123 ".to_string()).unwrap(), "G123");
    }

    #[test]
    fn validates_and_trims_contact_email() {
        assert_eq!(
            validated_email(" buyer@example.com ".to_string()).unwrap(),
            "buyer@example.com"
        );
        assert!(validated_email("buyer".to_string()).is_err());
        assert!(validated_email("buyer@localhost".to_string()).is_err());
    }
}
