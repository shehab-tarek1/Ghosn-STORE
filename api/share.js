module.exports = async (req, res) => { // تأكد من حرف m صغير
    const p = req.query.p;
    res.setHeader('Vary', 'User-Agent');

    if (!p) {
        res.writeHead(302, { 'Location': '/', 'Cache-Control': 'no-store' });
        return res.end();
    }

    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    // شرط الروبوت المحسن
    const isBot = /whatsapp|facebookexternalhit|twitterbot|telegrambot|googlebot/i.test(userAgent);

    if (!isBot) {
        res.writeHead(302, { 'Location': `/?p=${p}`, 'Cache-Control': 'no-store' });
        return res.end();
    }

    try {
        const projectId = 'marketing-e9fdf';
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
        
        const response = await fetch(firestoreUrl, {
            method: 'POST',
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'products' }],
                    where: { fieldFilter: { field: { fieldPath: 'shortCode' }, op: 'EQUAL', value: { stringValue: p } } },
                    limit: 1
                }
            })
        });

        const data = await response.json();
        const doc = data[0]?.document;

        if (!doc) throw new Error('Not Found');

        const fields = doc.fields;
        const title = fields.name?.stringValue || 'Ghosn STORE';
        const price = fields.price?.integerValue || fields.price?.doubleValue || '';
        const img = fields.images?.arrayValue?.values?.[0]?.stringValue || fields.img?.stringValue || 'https://res.cloudinary.com/dsxrjmcxs/image/upload/v1777061113/t2f9uqoiwgt2iukgsuih.jpg';
        
        // تصغير حجم الصورة لضمان ظهورها في واتساب بسرعة
        const optimizedImg = img.includes('cloudinary.com') 
            ? img.replace(/\/upload\/(?:[a-zA-Z0-9_,-]+\/)?/, '/upload/w_600,h_600,c_fill,q_80,f_jpg/') 
            : img;

        const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <meta property="og:title" content="${title} | ${price} ج.م" />
            <meta property="og:description" content="تسوق أحدث الملابس من متجر غصن" />
            <meta property="og:image" content="${optimizedImg}" />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary_large_image" />
        </head><body></body></html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);

    } catch (e) {
        res.writeHead(302, { 'Location': '/' });
        return res.end();
    }
};
