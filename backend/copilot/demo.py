import re
from .models import ModelOutput
from .safety import scan_risks


def demo_output(text, kb):
    """Deterministic illustrative templates. Never presented as an LLM evaluation."""
    t = text.casefold()
    ru = bool(re.search("[а-яё]", t))
    lang = (
        "ru"
        if ru
        else (
            "id"
            if any(x in t for x in ["bagaimana", "menyetor", "verifikasi"])
            else (
                "ms"
                if any(x in t for x in ["pengeluaran", "mendeposit", "akaun"])
                else "en"
            )
        )
    )
    flags = scan_risks(text)
    claims = []
    unknowns = []
    disposition = "draft"
    deposit = bool(re.search(r"deposit|пополн|депозит|menyetor|mendeposit", t))
    withdrawal = bool(re.search(r"withdraw|вывод|вывести|pengeluaran", t))
    verification = bool(re.search(r"kyc|verif|вериф|документ|провер.{0,10}личност", t))
    opening = bool(re.search(r"open.{0,15}account|откры.{0,15}сч[её]т|регистрац", t))
    category = (
        "deposit"
        if deposit
        else "withdrawal"
        if withdrawal
        else "verification"
        if verification
        else "account_opening"
        if opening
        else "other"
    )
    if "complaint" in flags:
        category = "complaint"
    elif re.search(r"\baml\b|отмыван", t):
        category = "aml"
        flags.add("kyc_aml")
    elif "trading_advice" in flags and not (deposit or withdrawal):
        category = "trading_advice"
    high = bool(
        re.search(r"unauthori[sz]ed|hacked|stolen|несанкционир|взлом|украл|украли", t)
    )
    urgent = (
        "high"
        if high
        else (
            "normal"
            if flags or re.search(r"not received|не приш|pending|reject", t)
            else "low"
        )
    )
    sentiment = (
        "negative"
        if re.search(r"angry|terrible|complaint|ridiculous|ужас|жалоб|злюсь|недовол", t)
        else ("positive" if re.search(r"thank|спасибо", t) else "neutral")
    )

    def claim(sid, evidence, description):
        claims.append(kb.find_claim(sid, evidence, description))

    def tr(r, e):
        return r if ru else e

    if "complaint" in flags:
        draft = tr(
            "Спасибо, что сообщили о проблеме. Я подготовлю обращение для специалиста по жалобам. Решение о компенсации или исходе жалобы должен принять человек.",
            "Thank you for reporting the issue. Your complaint needs a human reviewer. I cannot decide a compensation or complaint outcome.",
        )
        unknowns = [
            tr(
                "Исход жалобы и компенсация неизвестны.",
                "The complaint outcome and compensation are unknown.",
            )
        ]
        disposition = "abstain"
    elif (
        category == "aml"
        or re.search(r"approve|reject.{0,15}(kyc|verif)|bypass|одобр|обойти|разблок", t)
        and verification
    ):
        flags.add("kyc_aml")
        draft = tr(
            "Решение по проверке документов или AML должен принять специалист. Я не могу одобрить, отклонить или помочь обойти проверку.",
            "A specialist must decide KYC or AML outcomes. I cannot approve, reject, or help bypass verification.",
        )
        unknowns = [
            tr(
                "Решение по проверке неизвестно.",
                "The verification outcome is unknown.",
            )
        ]
        disposition = "abstain"
    elif "trading_advice" in flags and not deposit:
        draft = tr(
            "Я могу помочь с процедурами обслуживания, но не даю торговых рекомендаций, сигналов, целей цены или советов по кредитному плечу.",
            "I can help with support procedures, but cannot provide trading recommendations, signals, price targets, or leverage suggestions.",
        )
        disposition = "refuse"
    elif re.search(
        r"fee|commission|usdt|third.party|комисси|чуж.{0,10}(карт|сч)|треть.{0,10}лиц",
        t,
    ):
        draft = tr(
            "В доступных справочных страницах нет подтверждённой информации по этому вопросу. Передам его оператору для уточнения.",
            "The available help pages do not confirm this information. A support agent should clarify it.",
        )
        unknowns = [
            tr(
                "Запрошенные условия не указаны в разрешённой базе.",
                "The requested conditions are not specified in the allowed knowledge base.",
            )
        ]
        disposition = "abstain"
    elif high:
        draft = tr(
            "Сообщение о возможном несанкционированном доступе требует срочной проверки человеком. Доступные страницы не содержат процедуры восстановления или подтверждения состояния счёта.",
            "Possible unauthorized access requires urgent human review. The available pages do not specify account-recovery steps or confirm your account status.",
        )
        unknowns = [
            tr(
                "Состояние счёта и процедура восстановления неизвестны.",
                "Account status and recovery steps are unknown.",
            )
        ]
        disposition = "abstain"
    elif verification:
        flags.add("kyc_aml")
        if re.search(r"time|long|срок|сколько|48", t):
            evidence = "Account opening and document verification will be completed within 48 hours."
            draft = tr(
                "На странице открытия счёта опубликован срок до 48 часов для открытия и проверки документов. Это справочная информация, а не подтверждение срока или результата вашей конкретной проверки. Специалист должен проверить ваш случай.",
                "The account-opening page publishes a 48-hour timeframe for account opening and document verification. This is published information, not confirmation of your specific timing or outcome. A specialist must review your case.",
            )
            claim(
                "open_account",
                evidence,
                tr(
                    "Опубликованный срок — до 48 часов.",
                    "Published account-opening and document-verification timeframe is 48 hours.",
                ),
            )
        elif re.search(r"document|need|документ|нужн", t):
            evidence = "For live accounts, we will require a Proof of identification and Proof of address via a bank statement or a utility bill that are not older than 6 months. Please ensure that your name is clearly displayed in these documents."
            draft = tr(
                "Для реального счёта страница открытия указывает подтверждение личности и адреса: банковскую выписку либо коммунальный счёт не старше шести месяцев, с читаемым именем. Это перечень из справки; пригодность ваших документов определяет специалист.",
                "For live accounts, the account-opening page asks for proof of identification and proof of address via a bank statement or utility bill no older than six months, with your name clearly displayed. A specialist decides whether your actual documents are acceptable.",
            )
            claim(
                "open_account",
                evidence,
                tr(
                    "Документы из FAQ открытия счёта.",
                    "Published document requirements on the account-opening page.",
                ),
            )
        else:
            evidence = "Complete the required fields and upload the required documents to complete your KYC profile"
            draft = tr(
                "Заполните обязательные поля KYC-профиля и загрузите требуемые документы в личном кабинете. После этого профиль рассматривается. Я не могу подтвердить результат вашей проверки.",
                "Complete the required KYC-profile fields and upload the required documents in the Member Area. The profile is then reviewed; I cannot confirm your verification outcome.",
            )
            claim(
                "verify",
                evidence,
                tr(
                    "Заполнение полей и загрузка документов.",
                    "Fill the KYC fields and upload the required documents.",
                ),
            )
    elif deposit:
        draft = tr(
            "Войдите в Member Area, нажмите Deposit, выберите доступный платёжный канал и укажите реквизиты счёта и сумму.",
            "Log in to your Member Area, click Deposit, select your preferred available payment channel, and enter your account details and the amount.",
        )
        claim(
            "deposit",
            "Click on the Deposit button and select your preferred payment channel",
            tr("Выбор канала через Deposit.", "Choose a payment channel via Deposit."),
        )
        claim(
            "deposit",
            "Enter your account details and amount to deposit",
            tr("Ввод реквизитов и суммы.", "Enter account details and the amount."),
        )
        if re.search(r"minimum|миним", t):
            draft = tr(
                "В FAQ указан минимум от 8 USD в зависимости от типа счёта. Точный минимум для конкретного типа по этим страницам подтвердить нельзя.",
                "The FAQ lists a minimum starting at USD 8, depending on account type. These pages do not confirm the exact minimum for a specific account type.",
            )
            claims = []
            claim(
                "deposit",
                "The minimum deposit starts from 8 USD, depending on the account type.",
                tr(
                    "Минимум зависит от типа счёта.",
                    "The minimum depends on account type.",
                ),
            )
            unknowns = [
                tr(
                    "Минимум для конкретного типа счёта.",
                    "The minimum for the specific account type.",
                )
            ]
            disposition = "partial"
        if "trading_advice" in flags:
            draft += " " + tr(
                "Торговых рекомендаций и советов по плечу я не даю.",
                "I cannot provide trading or leverage recommendations.",
            )
            unknowns.append(
                tr(
                    "Торговая рекомендация отклонена.",
                    "The trading recommendation is declined.",
                )
            )
            disposition = "partial"
        elif "account_specific" in flags or re.search(
            r"not credited|not arrived|не зачис|не приш", t
        ):
            draft += " " + tr(
                "Состояние вашей операции нужно проверить оператору.",
                "A human agent must check your actual transaction status.",
            )
            flags.add("account_specific")
            unknowns = [
                tr(
                    "Фактический статус операции неизвестен.",
                    "The actual transaction status is unknown.",
                )
            ]
            disposition = "partial"
    elif withdrawal:
        if "pending" in t:
            evidence = "This means your request in in queue and in the midst of getting processed. Once approved, you will be notified."
            draft = tr(
                "В FAQ pending означает, что запрос находится в очереди и обрабатывается. Уведомление отправляется после одобрения; это не подтверждение, что ваш запрос уже одобрен.",
                "The FAQ says pending means the request is queued and being processed. Notification follows approval; this does not confirm that your request is already approved.",
            )
            claim(
                "withdraw",
                evidence,
                tr("Общее значение pending.", "General meaning of pending."),
            )
        else:
            flags.add("kb_conflict")
            draft = tr(
                "Страница вывода содержит неоднозначную инструкцию: некоторые шаги относятся к пополнению. Я не буду подменять её догадкой; оператор должен уточнить правильную процедуру.",
                "The withdrawal page contains an inconsistent procedure: some steps refer to depositing. I will not replace it with a guess; a support agent should clarify the correct process.",
            )
            unknowns = [
                tr(
                    "Надёжная полная процедура вывода.",
                    "A reliable complete withdrawal procedure.",
                )
            ]
            disposition = "abstain"
    elif opening:
        evidence = "Enter your details in the required fields and proceed to create your account"
        draft = tr(
            "На сайте выберите Create Account и заполните обязательные поля. После успешной регистрации предоставляется доступ к Member Area.",
            "Choose Create Account on the website and fill the required fields. Successful registration provides access to the Member Area.",
        )
        claim(
            "open_account",
            evidence,
            tr(
                "Заполнение обязательных полей регистрации.",
                "Fill the required registration fields.",
            ),
        )
        claim(
            "open_account",
            "Upon successful registration, you will be\nprovided\naccess to your own Member Area",
            tr(
                "Доступ к Member Area после регистрации.",
                "Member Area access after registration.",
            ),
        )
    else:
        draft = tr(
            "Уточните, пожалуйста, вопрос. Доступная база описывает пополнение, вывод, открытие счёта и верификацию.",
            "Please clarify your question. The available knowledge base covers deposits, withdrawals, account opening and verification.",
        )
        unknowns = [
            tr(
                "Недостаточно информации для ответа.",
                "There is not enough information to answer.",
            )
        ]
        disposition = "abstain"
    if lang in ("id", "ms"):
        # Limited illustrative language templates, not a multilingual classifier.
        if category == "deposit":
            draft = (
                "Masuk ke Member Area, pilih Deposit dan saluran pembayaran, lalu isi detail akun dan jumlah deposit."
                if lang == "id"
                else "Log masuk ke Member Area, pilih Deposit dan saluran pembayaran, kemudian isi butiran akaun dan jumlah deposit."
            )
        else:
            draft = (
                "Informasi yang tersedia tidak cukup. Mohon tinjauan agen dukungan."
                if lang == "id"
                else "Maklumat yang tersedia tidak mencukupi. Semakan ejen sokongan diperlukan."
            )
            claims = []
            unknowns = ["Perlu semakan manusia."]
            disposition = "abstain"
    return ModelOutput(
        category=category,
        secondary_categories=["trading_advice"]
        if "trading_advice" in flags and category != "trading_advice"
        else [],
        urgency=urgent,
        language=lang,
        sentiment=sentiment,
        disposition=disposition,
        draft=draft,
        claims=claims,
        unknowns=unknowns,
        risk_flags=sorted(flags),
        rationale="Демонстрационный шаблон и сигнальные правила. Содержательная точность LLM этим не измеряется.",
    )
