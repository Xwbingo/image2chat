Images API 是 gpt-image-2 的推荐出图方式，分为文生图和图片编辑两个接口：

文生图：POST https://www.packyapi.com/v1/images/generations
图片编辑 / 图生图：POST https://www.packyapi.com/v1/images/edits
每个接口下面都按“接口实例 → 参数介绍”的格式说明。对新手来说，只要先照着示例传 model、prompt，并把 n 设为 1；需要上传图片时再使用 image 字段即可。

# 生成图片
文生图使用 /v1/images/generations，上传参考图进行图片编辑使用 /v1/images/edits
```
curl --location 'https://www.packyapi.com/v1/images/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer 你的Sora分组令牌' \
--header 'Accept: */*' \
--header 'Host: www.packyapi.com' \
--header 'Connection: keep-alive' \
--data '{
    "model": "gpt-image-2",
    "prompt": "一只橘猫戴着橙色围巾抱着水獭，温暖插画风格",
    "size": "3840x2160",
    "quality": "high",
    "output_format": "png",
    "response_format": "url",
    "n": 1
}'
```
参数	类型	支持情况	说明
model	string	支持	固定填写 gpt-image-2。
prompt	string	支持	图片描述提示词，建议写清楚主体、场景、风格、比例和文字内容。
n	integer	仅支持 1	只支持一次返回 1 张图。n: 2、n: 4 这类多图数量不支持。
size	string	支持	支持 auto 和符合限制的尺寸，如 1024x1024、1536x1024、1024x1536、1536x864、3840x2160。
quality	string	支持	可选 low、medium、high、auto。草稿图可以用 low，正式出图可以用 high。
response_format	string	支持	可选 url、b64_json。默认建议用 url；b64_json 适合程序自行保存图片。
output_format	string	部分支持	推荐 png 或 jpeg。webp 不建议使用。
output_compression	integer	支持	只建议在 output_format 为 jpeg 时使用，取值 0 到 100。
background	string	部分支持	建议使用默认值或 opaque。transparent 不支持。
moderation	string	支持	可选 auto、low。这是安全审核参数，不会直接改变画面风格；不确定时保持默认即可。
user	string	支持	可选，用于标记你自己的终端用户或业务来源，普通调用可以不传。
stream	boolean	不支持	请不要开启。
partial_images	integer	不支持	依赖 stream 的中间图返回能力，不支持。
style	string	不建议使用	这是旧模型常见参数，gpt-image-2 不需要传。


# 编辑图片
/v1/images/edits 使用 multipart/form-data 上传图片。image 是二进制图片文件，prompt 写清楚希望怎么修改图片。
```
curl --location 'https://www.packyapi.com/v1/images/edits' \
--header 'Authorization: Bearer 你的Sora分组令牌' \
--header 'Accept: */*' \
--form 'model="gpt-image-2"' \
--form 'prompt="把图片里的主体保留，在右上角加一枚红色小印章，印章上写 DEMO"' \
--form 'image=@"/path/to/your-image.jpg"' \
--form 'size="1024x1024"' \
--form 'quality="high"' \
--form 'output_format="png"' \
--form 'response_format="url"'
```
model	string	支持	固定填写 gpt-image-2。
prompt	string	支持	写清楚要保留什么、修改什么、最终希望得到什么。
image	file	支持	必填，上传要编辑的图片二进制文件。建议一次只上传 1 张图片。
mask	file	支持	可选，局部修改时可传 PNG mask；不传则按整图编辑理解。
n	integer	仅支持 1	只支持一次返回 1 张图。多张结果 不支持。
size	string	支持	同文生图，支持 auto 和符合限制的尺寸。
quality	string	支持	可选 low、medium、high、auto。
response_format	string	支持	可选 url、b64_json。默认建议用 url。
output_format	string	部分支持	推荐 png 或 jpeg。webp 不建议使用。
output_compression	integer	支持	只建议在 output_format 为 jpeg 时使用，取值 0 到 100。
background	string	部分支持	建议使用默认值或 opaque。transparent 不支持。
moderation	string	支持	可选 auto、low。这是安全审核参数，不会直接改变画面风格。
input_fidelity	string	支持	图片编辑时可传 high，用于尽量保留原图主体和细节。
user	string	支持	可选，普通调用可以不传。
stream	boolean	不支持	请不要开启。
partial_images	integer	不支持	依赖 stream 的中间图返回能力，不支持。


# 参数补充
常用尺寸（Popular sizes）

1024 × 1024：正方形
1536 × 1024：横向
1024 × 1536：纵向
2048 × 2048：2K 正方形
2048 × 1152：2K 横向
3840 × 2160：4K 横向
2160 × 3840：4K 纵向
auto：自动（默认）
尺寸限制（Size constraints）

最大边长必须 小于或等于 3840 像素
宽和高都必须是 16 的倍数
长边与短边的比例 不能超过 3:1
总像素数必须 不少于 655,360，且 不超过 8,294,400
质量选项（Quality options）

low：低质量
medium：中等质量
high：高质量
auto：自动（默认）