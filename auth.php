<?php
/**
 * User Authentication Endpoint (Login, Register, Logout, Status)
 */

require_once __DIR__ . '/config/db.php';
startSecureSession();

$pdo = getDBConnection();
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: $_POST;
$action = $input['action'] ?? ($_GET['action'] ?? '');

// ======================== SESSION STATUS ========================
if ($action === 'status') {
    if (isset($_SESSION['user']['userid'])) {
        $userId = (int)$_SESSION['user']['userid'];
        // Fetch cart count
        $stmtCart = $pdo->prepare("SELECT cartid FROM Cart WHERE userid = ? LIMIT 1");
        $stmtCart->execute([$userId]);
        $cart = $stmtCart->fetch();
        $cartCount = 0;
        if ($cart) {
            $stmtCount = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) FROM Cart_Item WHERE cartid = ?");
            $stmtCount->execute([$cart['cartid']]);
            $cartCount = (int)$stmtCount->fetchColumn();
        }

        // Fetch wishlist count
        $stmtWish = $pdo->prepare("SELECT COUNT(*) FROM Wishlist WHERE userid = ?");
        $stmtWish->execute([$userId]);
        $wishlistCount = (int)$stmtWish->fetchColumn();

        sendJsonResponse([
            'success'       => true,
            'loggedIn'      => true,
            'user'          => $_SESSION['user'],
            'cartCount'     => $cartCount,
            'wishlistCount' => $wishlistCount
        ]);
    } else {
        sendJsonResponse([
            'success'  => true,
            'loggedIn' => false,
            'user'     => null
        ]);
    }
}

// ======================== USER LOGIN ========================
if ($action === 'login') {
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        sendJsonResponse(['success' => false, 'message' => 'Email and password are required.'], 400);
    }

    $stmt = $pdo->prepare("SELECT userid, firstName, lastName, email, password, isAdmin FROM Users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid email address or password.'], 401);
    }

    // Set secure session
    $_SESSION['user'] = [
        'userid'    => (int)$user['userid'],
        'firstName' => $user['firstName'],
        'lastName'  => $user['lastName'],
        'email'     => $user['email'],
        'isAdmin'   => (bool)$user['isAdmin']
    ];

    // Ensure user has a Cart record
    $pdo->prepare("INSERT IGNORE INTO Cart (userid) VALUES (?)")->execute([(int)$user['userid']]);

    sendJsonResponse([
        'success' => true,
        'message' => 'Welcome back, ' . htmlspecialchars($user['firstName']) . '!',
        'user'    => $_SESSION['user']
    ]);
}

// ======================== USER REGISTRATION ========================
if ($action === 'register') {
    $firstName = trim($input['firstName'] ?? '');
    $lastName = trim($input['lastName'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($firstName) || empty($lastName) || empty($email) || empty($password)) {
        sendJsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 400);
    }

    if (strlen($password) < 6) {
        sendJsonResponse(['success' => false, 'message' => 'Password must be at least 6 characters long.'], 400);
    }

    // Check duplicate email
    $stmtCheck = $pdo->prepare("SELECT userid FROM Users WHERE email = ? LIMIT 1");
    $stmtCheck->execute([$email]);
    if ($stmtCheck->fetch()) {
        sendJsonResponse(['success' => false, 'message' => 'An account with this email address already exists.'], 409);
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    try {
        $pdo->beginTransaction();

        $stmtInsert = $pdo->prepare("
            INSERT INTO Users (firstName, lastName, email, password, isAdmin)
            VALUES (?, ?, ?, ?, 0)
        ");
        $stmtInsert->execute([$firstName, $lastName, $email, $hashedPassword]);
        $newUserId = (int)$pdo->lastInsertId();

        // Initialize User Cart
        $pdo->prepare("INSERT INTO Cart (userid) VALUES (?)")->execute([$newUserId]);

        // Generate a 15% Welcome Promo Code
        $welcomePromo = 'WELCOME' . strtoupper(substr(md5(uniqid('', true)), 0, 4));
        $expDate = date('Y-m-d', strtotime('+30 days'));
        $stmtPromo = $pdo->prepare("
            INSERT INTO PromoCode (userid, code, type, price, isValid, exp_date)
            VALUES (?, ?, 'percentage', 15.00, 1, ?)
        ");
        $stmtPromo->execute([$newUserId, $welcomePromo, $expDate]);

        $pdo->commit();

        // Set session
        $_SESSION['user'] = [
            'userid'    => $newUserId,
            'firstName' => $firstName,
            'lastName'  => $lastName,
            'email'     => $email,
            'isAdmin'   => false
        ];

        sendJsonResponse([
            'success'     => true,
            'message'     => 'Registration successful! Welcome to BookStore.',
            'user'        => $_SESSION['user'],
            'welcomeCode' => $welcomePromo
        ]);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Registration error: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()], 500);
    }
}

// ======================== USER LOGOUT ========================
if ($action === 'logout') {
    unset($_SESSION['user']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    sendJsonResponse(['success' => true, 'message' => 'Successfully logged out.']);
}

sendJsonResponse(['success' => false, 'message' => 'Invalid action.'], 400);