module.exports = async (req, res) => {
    const code = req.query.code;

    // إخبار الكاش أن النتيجة تعتمد على نوع الزائر (بوت أو إنسان)
    res.setHeader('Vary', 'User-Agent');

    if (!code) {
        res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-store' });
        return res.end();
    }

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    // قائمة البوتات الشاملة المعتمدة
    const isBot = /bot|facebook|whatsapp|telegram|viber|skype|twitter|discord|linkedin|slack|pinterest|applebot/i.test(userAgent);

    // توجيه الزوار العاديين فوراً للمتجر الأساسي
    if (!isBot) {
        const safeCode = encodeURIComponent(code);
        res.writeHead(302, { 'Location': `/?p=${safeCode}`, 'Cache-Control': 'no-store' });
        return res.end();
    }

    // بيانات مشروعك في فايربيز Esca Store
    const projectId = 'esca-store';
    const collectionName = 'products';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    try {
        const response = await fetch(firestoreUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: collectionName }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'shortCode' },
                            op: 'EQUAL',
                            value: { stringValue: String(code) }
                        }
                    },
                    limit: 1
                }
            })
        });

        const data = await response.json();

        if (!data || !data[0] || !data[0].document) {
            throw new Error('لم يتم العثور على المنتج');
        }

        const fields = data[0].document.fields || {};

        // 1. عنوان المنتج
        let title = fields.name?.stringValue || 'Esca Store';
        const price = fields.price?.integerValue || fields.price?.doubleValue || '';
        if (price) {
            title += ` | ${price} ج.م`;
        }
        title += ` | كود: ${code}`;

        // 2. وصف المنتج
        let productDesc = fields.description?.stringValue || 'تسوق أحدث الحقائب والأحذية بأفضل الأسعار من متجر Esca Store.';
        // تنظيف الوصف من أي أسطر جديدة واستبدالها بمساحات
let cleanDesc = productDesc.replace(/[\r\n]+/g, ' ').trim();

// دمج الوصف في سطر واحد متصل باستخدام فواصل أنيقة يفهمها فيسبوك
let desc = `${cleanDesc} • للطلب تواصل واتساب: 01206244875`;

        // 3. صورة المنتج
        let imageUrl = fields.images?.arrayValue?.values?.[0]?.stringValue || fields.img?.stringValue || 'https://res.cloudinary.com/dsxrjmcxs/image/upload/v1786578381/sot79yhkjy82ptwel6em.jpg';
        let siteUrl = `https://${req.headers.host}/p/${encodeURIComponent(code)}`;

        // تحسين صور Cloudinary لتناسب مقاسات الواتساب
        if (imageUrl.includes('res.cloudinary.com') && imageUrl.includes('/upload/')) {
            let parts = imageUrl.split('/upload/');
            let rawEnd = parts[1];

            let versionMatch = rawEnd.match(/(v\d+\/.*)/);
            if (versionMatch) {
                rawEnd = versionMatch[1]; 
            } else {
                let splitSlash = rawEnd.split('/');
                rawEnd = splitSlash[splitSlash.length - 1]; 
            }

            imageUrl = `${parts[0]}/upload/c_limit,w_1200,q_auto,f_auto/${rawEnd}`;
        }

        // دالة حماية النصوص لمنع كسر أكواد HTML
        const escapeHTML = (str) => {
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const safeTitle = escapeHTML(title);
        const safeDesc = escapeHTML(desc);

        const botHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Esca Store" />
    <meta property="og:url" content="${siteUrl}" />
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
    <script>
        // إعادة توجيه في حال فتح الصفحة للبوت بالخطأ
        window.location.href = "/?p=${encodeURIComponent(code)}";
    </script>
</body>
</html>
`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); 

        return res.status(200).send(botHtml);

    } catch (error) {
        console.error('Share preview error:', error);
        res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-store' });
        return res.end();
    }
};