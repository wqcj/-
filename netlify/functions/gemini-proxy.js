const fetch = require('node-fetch');

// CORS 头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function(event, context) {
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { GEMINI_API_KEY, ALLOWED_ORIGINS } = process.env;
    
    // 验证环境变量
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // 动态设置 CORS 来源
    const requestOrigin = event.headers.origin || event.headers.referer;
    const allowedOrigins = ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',') : ['*'];
    const corsOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin) 
      ? requestOrigin 
      : allowedOrigins[0];

    const dynamicCorsHeaders = {
      ...corsHeaders,
      'Access-Control-Allow-Origin': corsOrigin
    };

    // 解析请求体
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: dynamicCorsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { prompt, model = 'gemini-2.0-flash-exp', ...otherParams } = requestBody;

    // 验证必需参数
    if (!prompt) {
      return {
        statusCode: 400,
        headers: dynamicCorsHeaders,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // 构建 Gemini API 请求
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiRequestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      ...otherParams
    };

    // 调用 Gemini API
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      return {
        statusCode: response.status,
        headers: dynamicCorsHeaders,
        body: JSON.stringify({ 
          error: `Gemini API error: ${response.status}`,
          details: errorText
        })
      };
    }

    const geminiData = await response.json();

    // 返回成功响应
    return {
      statusCode: 200,
      headers: {
        ...dynamicCorsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: geminiData,
        usage: {
          prompt_tokens: geminiData.usageMetadata?.promptTokenCount || 0,
          completion_tokens: geminiData.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: geminiData.usageMetadata?.totalTokenCount || 0
        }
      })
    };

  } catch (error) {
    console.error('Proxy function error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
