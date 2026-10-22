describe('RealWorld public UI', () => {
  it('loads the home page and public navigation', () => {
    cy.visit('/')

    cy.get('nav').within(() => {
      cy.contains('a', 'conduit').should('be.visible')
      cy.contains('a', 'Home').should('be.visible')
      cy.contains('a', 'Sign in').should('be.visible')
      cy.contains('a', 'Sign up').should('be.visible')
    })
    cy.contains('h1', 'conduit').should('be.visible')
    cy.contains('a', 'Global Feed').should('be.visible')
    cy.contains('p', 'Popular Tags').should('be.visible')
  })

  it('opens the sign-in form from the navigation', () => {
    cy.visit('/')
    cy.get('nav').contains('a', 'Sign in').click()

    cy.location('pathname').should('eq', '/user/login')
    cy.contains('h1', 'Sign in').should('be.visible')
    cy.get('input[type="email"][placeholder="Email"]').should('be.visible')
    cy.get('input[type="password"][placeholder="Password"]').should('be.visible')
    cy.get('button[type="submit"]').should('contain.text', 'Sign in')
  })
})
