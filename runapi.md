GPT-Image 2 — the next evolution of OpenAI's image generation models, offering enhanced visual understanding and generation capabilities, with support for more complex prompts and higher-quality outputs.

# 生成图片
curl --location --request POST 'https://runapi.co/v1/images/generations' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "size": "1024x1024",
  "prompt": "A cute little pig",
  "model": "gpt-image-2",
  "n": 1
}'

# 编辑图片
curl --location --request POST 'https://runapi.co/v1/images/edits' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer <token>' \
--form 'image=@"/path/to/1.jpg"' \
--form 'image=@"/path/to/2.jpg"' \
--form 'prompt="Merge them into one image"' \
--form 'model="gpt-image-2"' \
--form 'n="1"' \
--form 'size="1024x1536"'