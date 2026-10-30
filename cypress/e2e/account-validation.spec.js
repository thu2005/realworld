/* global cy */

describe('RealWorld account validation', () => {
  it('shows the API error when signing in without a password', () => {
    cy.intercept('POST', '/api/users/login').as('login')
    cy.visit('/user/login')
    cy.get('input[placeholder="Email"]').type('seminar@example.com')
    cy.get('button[type="submit"]').click()

    cy.wait('@login').its('response.statusCode').should('eq', 422)
    cy.get('.error-messages').should('contain.text', 'password')
    cy.get('.error-messages').should('contain.text', "can't be blank")
    cy.get('button[type="submit"]').should('not.be.disabled')
    cy.location('pathname').should('eq', '/user/login')
  })

  it('rejects invalid credentials and keeps the user signed out', () => {
    cy.intercept('POST', '/api/users/login').as('login')
    cy.visit('/user/login')
    cy.get('input[placeholder="Email"]').type('missing-user@example.invalid')
    cy.get('input[placeholder="Password"]').type('invalid-seminar-password')
    cy.get('button[type="submit"]').click()

    cy.wait('@login').its('response.statusCode').should('eq', 422)
    cy.get('.error-messages').should('contain.text', 'email or password')
    cy.get('.error-messages').should('contain.text', 'is invalid')
    cy.location('pathname').should('eq', '/user/login')
    cy.get('nav').contains('a', 'Sign in').should('be.visible')
  })

  it('opens registration and rejects a missing password', () => {
    cy.intercept('POST', '/api/users').as('register')
    cy.visit('/user/login')
    cy.contains('a', 'Need an account?').click()
    cy.location('pathname').should('eq', '/user/register')
    cy.get('input[placeholder="Username"]').type('seminar-validation')
    cy.get('input[placeholder="Email"]').type('seminar@example.com')
    cy.get('button[type="submit"]').click()

    cy.wait('@register').its('response.statusCode').should('eq', 422)
    cy.get('.error-messages').should('contain.text', 'password')
    cy.get('.error-messages').should('contain.text', "can't be blank")
    cy.get('button[type="submit"]').should('not.be.disabled')
    cy.location('pathname').should('eq', '/user/register')
  })
})
