module.exports = async (req, res) => {
    // جلب كود المنتج من الرابط
    const p = req.query.p || req.url.split('/').pop().split('?')[0];

    // إذا لم يكن هناك كود، توجه للرئيسية
    if (!p) {
        res.writeHead(302, { 'Location': '/' });
        return res.end();
    }

    const projectId = 'esca-store'; 
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    // البيانات الافتراضية للمتجر في حال حدوث أي خطأ أو عدم وجود المنتج
    let title = 'Esca Store | متجر';
    let desc = 'تسوق أحدث الحقائب والاحذية بافضل الاسعار';
    let imageUrl = 'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_600,q_auto,f_auto/v1786578381/sot79yhkjy82ptwel6em.jpg';

    try {
        const response = await fetch(firestoreUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'products' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'shortCode' },
                            op: 'EQUAL',
                            value: { stringValue: String(p) }
                        }
                    },
                    limit: 1
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0].document && data[0].document.fields) {
                const fields = data[0].document.fields;
                
                const prodName = fields.name?.stringValue || 'Esca Store';
                const price = fields.price?.integerValue || fields.price?.doubleValue || '';
                const prodDesc = fields.description?.stringValue || desc;

                title = `${prodName}${price ? ' | ' + price + ' ج.م' : ''}`;
                desc = `🔖 كود المنتج: ${p} - ${prodDesc}`;

                if (fields.images?.arrayValue?.values?.length > 0) {
                    imageUrl = fields.images.arrayValue.values[0].stringValue;
                } else if (fields.img?.stringValue) {
                    imageUrl = fields.img.stringValue;
                }

                // تحسين الصورة لواتساب
                if (imageUrl.includes('cloudinary.com')) {
                    imageUrl = imageUrl.replace(
                        /\/upload\/(?:[a-zA-Z0-9_,-]+\/)?/, 
                        '/upload/w_600,h_600,c_fill,q_80,f_jpg/'
                    );
                }
            }
        }
    } catch (error) {
        console.error("Firestore Fetch Error:", error);
    }

    // بناء صفحة الـ HTML التي تحتوي على الـ Meta Tags + توجيه الجافاسكربت للبشر
    const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <meta property="og:type" content="website" />
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${desc}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:image:secure_url" content="${imageUrl}" />
            <meta property="og:image:type" content="image/jpeg" />
            <meta property="og:image:width" content="600" />
            <meta property="og:image:height" content="600" />
            <meta property="og:site_name" content="Esca Store" />
            <meta property="og:url" content="https://${req.headers.host}/p/${p}" />
            
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${desc}" />
            <meta name="twitter:image" content="${imageUrl}" />

            <!-- التوجيه التلقائي للمستخدم البشري للمتجر الرئيسي -->
            <script>
                window.location.href = "/?p=${p}";
            </script>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h3>جاري تحويلك إلى المنتج...</h3>
            <p><a href="/?p=${p}">إضغط هنا إذا لم يتم تحويلك تلقائياً</a></p>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
};