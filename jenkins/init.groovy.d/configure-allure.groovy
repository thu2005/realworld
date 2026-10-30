import hudson.tools.InstallSourceProperty
import jenkins.model.Jenkins
import org.allurereport.jenkins.tools.AllureCommandlineInstallation
import org.allurereport.jenkins.tools.AllureManagedInstaller

def descriptor = Jenkins.get().getDescriptorByType(
  AllureCommandlineInstallation.DescriptorImpl
)
def installations = descriptor.getInstallations() as List

if (!installations.any { it.name == 'allure' }) {
  def installer = new AllureManagedInstaller(
    AllureManagedInstaller.VERSION_POLICY_RECOMMENDED_ALLURE_2
  )
  def properties = [new InstallSourceProperty([installer])]
  def installation = new AllureCommandlineInstallation(
    'allure',
    '',
    properties
  )
  descriptor.setInstallations(
    (installations + installation) as AllureCommandlineInstallation[]
  )
  descriptor.save()
  println 'Configured Jenkins Allure commandline tool: allure'
}
